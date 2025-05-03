/**
 * MCP 搜索服务器实现
 * 基于 Anthropic 的 Model Context Protocol 标准
 * 
 * 注意：由于 MCP SDK 接口可能已更新，此实现是基于 MCP 协议规范的简化版本
 * 而非直接使用 SDK 的默认接口，以确保兼容性。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import 'dotenv/config';
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';

// 导入真实的 WebSearchService 所需依赖
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// 导入安全日志模块和TCP传输模块
import { safeLog, ensureLogDirectory, logFile } from './safe-logger';
import { TcpServerTransport } from './tcp-transport';


/**
 * 为MCP子进程提供的全功能搜索服务
 * 基于原WebSearchService实现，做了必要的简化以适应子进程环境
 */
class MCPWebSearchService {
  private apiKey: string;
  private geminiApiKey: string;
  private searchEndpoint: string;
  private genAI: GoogleGenerativeAI | null = null;
  
  constructor() {
    // 初始化API密钥
    this.apiKey = process.env.SERPER_API_KEY || "";
    this.geminiApiKey = process.env.GEMINI_API_KEY || "";
    this.searchEndpoint = "https://google.serper.dev/search";
    
    // 初始化Gemini API
    if (this.geminiApiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
        // 避免在子进程中使用标准输出，可能导致EPIPE错误
        // console.log("[MCP-SEARCH] Gemini API 初始化成功");
      } catch (error) {
        // 避免在子进程中使用标准错误输出，可能导致EPIPE错误
        // console.error("[MCP-SEARCH] Gemini API 初始化失败:", error);
        this.genAI = null;
      }
    } else {
      // 避免在子进程中使用标准警告输出，可能导致EPIPE错误
      // console.warn("[MCP-SEARCH] Gemini API 密钥未设置");
    }
  }
  
  /**
   * 为提示词处理搜索结果
   * @param snippets 搜索结果片段
   * @returns 格式化的字符串
   */
  private formatSearchContextForMCP(snippets: any[]): string {
    let context = "";
    
    snippets.forEach((snippet, index) => {
      context += `--- 结果 ${index + 1} ---\n`;
      context += `标题: ${snippet.title}\n`;
      context += `摘要: ${snippet.snippet}\n`;
      if (snippet.url) {
        context += `URL: ${snippet.url}\n`;
      }
      context += "\n";
    });
    
    return context;
  }
  
  /**
   * 解析JSON响应，处理可能的错误
   */
  private parseJsonResponse(text: string): any {
    try {
      // 尝试去除可能存在的markdown格式
      let jsonText = text;
      
      // 如果是代码块格式，提取其中的JSON
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1];
      }
      
      return JSON.parse(jsonText);
    } catch (error) {
      safeLog(`[MCP-SEARCH] JSON解析错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return null;
    }
  }
  
  /**
   * 标准化相关性评分
   */
  private normalizeRelevanceScore(value: any): number {
    // 如果是数字字符串，转为数字
    if (typeof value === 'string') {
      const parsedValue = parseInt(value, 10);
      if (!isNaN(parsedValue)) {
        value = parsedValue;
      }
    }
    
    // 确保是数字类型
    if (typeof value !== 'number' || isNaN(value)) {
      return 7; // 默认相关性评分
    }
    
    // 限制在1-10范围内
    return Math.max(1, Math.min(10, value));
  }
  
  /**
   * 执行基础搜索
   * @param query 搜索查询
   * @returns 搜索结果片段
   */
  async search(query: string) {
    safeLog(`[MCP-SEARCH] 执行基础搜索: ${query}`, 'info');
    
    // 如果API密钥未设置，返回默认结果
    if (!this.apiKey) {
      safeLog("[MCP-SEARCH] 搜索API密钥未设置，使用默认结果", 'warn');
      return [
        {
          title: `关于"${query}"的搜索结果`,
          snippet: `请设置SERPER_API_KEY环境变量以启用真实搜索功能。`,
          url: 'https://example.com/search-results'
        }
      ];
    }
    
    try {
      // 执行实际搜索调用
      const response = await fetch(this.searchEndpoint, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: query,
          gl: "cn", // 地理位置：中国
          hl: "zh-cn", // 语言：简体中文
          num: 10 // 结果数量
        })
      });
      
      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status} ${response.statusText}`);
      }
      
      const searchData = await response.json() as any;
      
      // 处理搜索结果
      const snippets: any[] = [];
      
      // 处理自然搜索结果
      if (searchData?.organic && Array.isArray(searchData.organic)) {
        for (const result of searchData.organic) {
          snippets.push({
            title: result.title || "",
            snippet: result.snippet || "",
            url: result.link || ""
          });
        }
      }
      
      // 处理知识面板结果（如果有）
      if (searchData?.knowledgeGraph) {
        const kg = searchData.knowledgeGraph;
        snippets.push({
          title: kg.title || "知识面板",
          snippet: kg.description || "",
          url: kg.descriptionLink || ""
        });
      }
      
      // 处理相关问题（如果有）
      if (searchData?.relatedSearches && Array.isArray(searchData.relatedSearches)) {
        const relatedQuestions = searchData.relatedSearches
          .slice(0, 3) // 只取前3个相关问题
          .map((q: any) => q.query)
          .join(", ");
        
        if (relatedQuestions) {
          snippets.push({
            title: "相关问题",
            snippet: relatedQuestions,
            url: ""
          });
        }
      }
      
      safeLog(`[MCP-SEARCH] 搜索完成，获取到 ${snippets.length} 条结果`, 'info');
      return snippets;
      
    } catch (error) {
      safeLog(`[MCP-SEARCH] 搜索错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
      // 返回默认结果
      return [
        {
          title: `关于"${query}"的搜索`,
          snippet: `搜索时发生错误: ${error instanceof Error ? error.message : String(error)}`,
          url: 'https://example.com/search-error'
        }
      ];
    }
  }
  
  /**
   * 执行MCP增强搜索
   * @param query 搜索查询
   * @returns 增强的搜索结果
   */
  async searchWithMCP(query: string) {
    try {
      safeLog(`[MCP-SEARCH] 执行MCP搜索: ${query}`, 'info');
      
      if (!query || query.trim().length === 0) {
        safeLog(`[MCP-SEARCH] 搜索查询为空，无法执行`, 'info');
        return null;
      }
      
      // 检查Gemini API是否可用
      if (!this.genAI) {
        safeLog(`[MCP-SEARCH] MCP搜索需要Gemini API，但API未初始化`, 'warn');
        return null;
      }
      
      // 执行常规搜索获取原始结果
      const snippets = await this.search(query);
      
      if (!snippets || snippets.length === 0) {
        safeLog(`[MCP-SEARCH] MCP搜索未找到结果: ${query}`, 'warn');
        return null;
      }
      
      // 使用Gemini模型处理搜索结果，生成结构化数据
      return await this.processMCPResult(query, snippets);
      
    } catch (error) {
      safeLog(`[MCP-SEARCH] MCP搜索错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // 提供备用结果，确保服务不中断
      return {
        query,
        summary: `关于"${query}"的搜索概述。(系统生成的备用响应)`,
        relevance: 6.5,
        keyPoints: [
          `搜索"${query}"时遇到处理问题`,
          `系统已提供备用响应`,
          `您可以尝试重新搜索或修改搜索词`
        ],
        sources: [
          {
            title: '系统消息',
            url: 'https://example.com/search',
            content: `处理"${query}"搜索时发生错误: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
  
  /**
   * 使用Gemini处理自定义结构化搜索结果
   */
  private async processMCPResult(
    query: string,
    snippets: any[]
  ): Promise<any> {
    try {
      // 构建Gemini模型
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash", // 使用轻量级模型，降低成本
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          }
        ]
      });
      
      // 将搜索结果转换为文本
      const searchContext = this.formatSearchContextForMCP(snippets);
      
      // 构建提示词
      const prompt = `
您是一个搜索内容处理专家，请分析以下搜索结果，并以JSON格式输出结构化信息。

搜索查询: "${query}"

搜索结果:
${searchContext}

请以JSON格式输出以下内容:
{
  "summary": "搜索结果的综合摘要，简洁、全面、不超过100字",
  "relevance": "搜索结果与查询相关性评分，范围1-10的整数",
  "keyPoints": ["关键信息点1", "关键信息点2", ...], // 3-5个关键要点
  "sources": [
    {
      "title": "来源标题",
      "url": "URL地址",
      "content": "简要内容摘录"
    },
    ...
  ] // 最多包含3个最相关的来源
}`;
      
      // 发送请求到模型
      const response = await model.generateContent({
        contents: [{
          role: 'user' as const,
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        }
      });
      
      const result = response.response;
      const textResponse = result.text();
      
      // 解析JSON响应
      const mcpData = this.parseJsonResponse(textResponse);
      if (!mcpData) {
        throw new Error("无法解析MCP结果");
      }
      
      // 构建结构化搜索结果
      return {
        query,
        summary: mcpData.summary || `关于"${query}"的搜索结果`,
        relevance: this.normalizeRelevanceScore(mcpData.relevance),
        keyPoints: Array.isArray(mcpData.keyPoints) ? mcpData.keyPoints : [],
        sources: Array.isArray(mcpData.sources) ? mcpData.sources : [],
        timestamp: Date.now()
      };
      
    } catch (error) {
      safeLog(`[MCP-SEARCH] MCP处理错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      // 返回最基本的结果
      return {
        query,
        summary: `关于"${query}"的搜索结果概述。`,
        relevance: 7.0,
        keyPoints: [
          `与"${query}"相关的要点1`,
          `与"${query}"相关的要点2`,
          `与"${query}"相关的要点3`
        ],
        sources: snippets.slice(0, 3).map((snippet, index) => ({
          title: snippet.title || `结果 ${index + 1}`,
          url: snippet.url || 'https://example.com',
          content: snippet.snippet || `关于"${query}"的内容`
        }))
      };
    }
  }
}

// 创建搜索服务实例
const mcpWebSearchService = new MCPWebSearchService();

// 创建 MCP Server (提示：如果SDK有变更，这里可能需要适配)
const server = new McpServer({ 
  name: "mcp-search-server", 
  version: "1.0.0",
  // 添加自定义信息，确保新版SDK客户端能获取服务器信息
  capabilities: ["webSearch"],
  info: {
    description: "MCP搜索服务，支持多种搜索模式"
  }
});

// 创建扩展接口来避免TypeScript错误
interface ExtendedStdioTransport extends StdioServerTransport {
  emit?: (eventName: string, message: string) => void;
  on?: (eventName: string, callback: (data: string) => void) => void;
  handleMessage?: (message: string) => void;
  write?: (data: string) => Promise<any>;
}

// 创建双重 Transport，同时支持 stdio 和 TCP
// 这允许我们在不影响当前功能的情况下添加TCP支持
const stdioTransport = new StdioServerTransport() as ExtendedStdioTransport;

// TCP传输层初始化
const tcpTransport = new TcpServerTransport();

// 我们需要给标准IO传输层加入类似emit的方法
safeLog('为StdioServerTransport添加过渡兼容方法')
// 添加emit方法用于转发消息
stdioTransport.emit = function(eventName: string, message: string) {
  if (eventName === 'message' && message) {
    // 直接调用是该传输对象的内部处理方法
    stdioTransport.handleMessage?.(message);
  }
};

// 定义搜索参数的模式
const searchParamsSchema = {
  query: z.string().min(1, "搜索查询不能为空"),
  useMCP: z.boolean().optional().default(true),
  numResults: z.number().int().min(1).max(20).optional().default(5)
};

// 简化：直接注册搜索函数作为工具
// 注意：如果 SDK API 与此不匹配，请使用更底层的 RPC 方式实现
try {
  // 避免在子进程中使用标准输出
  safeLog(`注册MCP搜索工具函数`, 'info');
  
  // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
  if (server.tool) {
    server.tool("webSearch", async (params: any) => {
    try {
      // 新的参数处理逻辑 - MCP SDK可能通过多种方式传递参数
      // 检查所有可能的参数位置
      let queryValue = "";
      
      // 尝试所有可能的参数结构
      if (typeof params === 'string') {
        queryValue = params; // 直接是查询字符串
        safeLog(`[MCP-SERVER] 参数是字符串: ${queryValue}`, 'info');
      } 
      else if (typeof params === 'object') {
        if (params === null) {
          safeLog(`[MCP-SERVER] 参数是null`, 'info');
        } else {
          safeLog(`[MCP-SERVER] 参数是对象，键: ${Object.keys(params).join(', ')}`, 'info');
          
          // 检查常见参数结构
          if (params.query) {
            queryValue = params.query; // 标准结构
            safeLog(`[MCP-SERVER] 从params.query获取值: ${queryValue}`, 'info');
          } 
          else if (params.arguments && typeof params.arguments === 'object') {
            // arguments包含参数
            if (params.arguments.query) {
              queryValue = params.arguments.query;
              safeLog(`[MCP-SERVER] 从params.arguments.query获取值: ${queryValue}`, 'info');
            }
          }
          else {
            // 遍历所有键查找查询
            for (const key of Object.keys(params)) {
              if (typeof params[key] === 'string' && params[key].length > 0) {
                queryValue = params[key];
                safeLog(`[MCP-SERVER] 从params[${key}]获取可能的查询值: ${queryValue}`, 'info');
                break;
              }
              else if (typeof params[key] === 'object' && params[key]?.query) {
                queryValue = params[key].query;
                safeLog(`[MCP-SERVER] 从params[${key}].query获取值: ${queryValue}`, 'info');
                break;
              }
            }
          }
        }
      }
      
      // 最终的查询和参数处理
      const query = queryValue || ""; // 如果没有查询，使用空字符串
      
      // 如果查询为空，返回错误
      if (!query) {
        safeLog("[MCP-SERVER] 搜索查询为空", 'error');
        return { 
          content: [{ 
            type: "text", 
            text: "搜索查询不能为空，请提供有效的查询内容" 
          }]
        };
      }
      
      // 提取布尔型参数
      let useMCP = true; // 默认使用MCP
      if (typeof params === 'object' && params !== null) {
        if (params.useMCP !== undefined) {
          useMCP = Boolean(params.useMCP);
        } else if (params.arguments && params.arguments.useMCP !== undefined) {
          useMCP = Boolean(params.arguments.useMCP);
        }
      }
      
      // 提取数字型参数
      let numResults = 5; // 默认结果数量
      if (typeof params === 'object' && params !== null) {
        if (params.numResults !== undefined) {
          const parsedNum = parseInt(String(params.numResults), 10);
          if (!isNaN(parsedNum)) {
            numResults = parsedNum;
          }
        } else if (params.arguments && params.arguments.numResults !== undefined) {
          const parsedNum = parseInt(String(params.arguments.numResults), 10);
          if (!isNaN(parsedNum)) {
            numResults = parsedNum;
          }
        }
      }
      
      safeLog(`[MCP-SERVER] 最终处理的参数: query=${query}, useMCP=${useMCP}, numResults=${numResults}`, 'info');
      
      // 根据 useMCP 标志决定使用哪种搜索方式
      if (useMCP) {
        try {
          safeLog(`[MCP-SERVER] 尝试使用MCP增强搜索模式执行查询: ${query}`, 'info');
          const mcpResult = await mcpWebSearchService.searchWithMCP(query);
          
          if (!mcpResult) {
            safeLog(`[MCP-SERVER] MCP模式未返回结果，切换到基础搜索模式`, 'warn');
            throw new Error("MCP搜索未返回结果");
          }
          
          // 格式化搜索结果
          return {
            content: [
              {
                type: "text",
                text: `## ${query} - 搜索摘要\n\n${mcpResult.summary}\n\n相关性: ${mcpResult.relevance}/10\n\n` +
                      `关键信息点:\n${mcpResult.keyPoints.map((p: string) => `• ${p}`).join("\n")}\n\n` +
                      `来源:\n${mcpResult.sources.map((s: any, i: number) => 
                        `[${i+1}] ${s.title} - ${s.url}\n${s.content}`).join("\n\n")}`
              }
            ]
          };
        } catch (mcpError) {
          safeLog(`[MCP-SERVER] MCP模式执行失败，自动切换到基础搜索模式: ${mcpError instanceof Error ? mcpError.message : String(mcpError)}`, 'warn');
          // MCP模式失败，自动切换到基础搜索模式
          useMCP = false;
          // 继续执行非MCP部分的代码
        }
      }
      
      // 如果useMCP为false或MCP模式执行失败，使用基础搜索
      safeLog(`[MCP-SERVER] 使用基础搜索模式执行查询: ${query}`, 'info');
      const snippets = await mcpWebSearchService.search(query);
      
      if (!snippets || snippets.length === 0) {
        return { content: [{ type: "text", text: "未找到相关搜索结果" }] };
      }
      
      // 格式化结果
      return {
        content: [
          {
            type: "text",
            text: `## ${query} - 基础搜索结果\n\n` + 
                  snippets.slice(0, numResults).map((s: {title: string; snippet: string; url: string}, i: number) => 
                  `[${i+1}] ${s.title}\n${s.snippet}\n${s.url}`).join("\n\n")
          }
        ]
      };
    } catch (error) {
      safeLog(`搜索执行出错: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return {
        content: [{ 
          type: "text", 
          text: `搜索执行失败: ${error instanceof Error ? error.message : String(error)}` 
        }]
      };
    }
    });
  }
} catch (error) {
  safeLog(`MCP 工具注册方式可能已更新，错误: ${error instanceof Error ? error.message : String(error)}`, 'warn');
  safeLog("建议查阅最新的 MCP SDK 文档以更新实现", 'warn');
}

// 启动服务
export async function startMcpSearchServer() {
  try {
    // 确保日志目录存在
    ensureLogDirectory();
    
    // 启动 TCP 服务器
    try {
      await tcpTransport.start();
      safeLog("MCP TCP 服务器已启动", 'info');
    } catch (tcpError) {
      safeLog(`MCP TCP 服务器启动失败: ${tcpError instanceof Error ? tcpError.message : String(tcpError)}`, 'warn');
      safeLog('将继续使用 stdio 传输', 'info');
    }
    
    // 连接到 stdio 传输
    await server.connect(stdioTransport);
    safeLog("MCP 搜索服务已启动，监听 stdio...", 'info');
    
    return { success: true };
  } catch (error) {
    safeLog(`MCP 服务启动失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// 处理 TCP 连接的消息
tcpTransport.on('message', async (message: string) => {
  try {
    // 将消息转发到 MCP 服务器
    // 这里我们需要模拟 stdio 的行为，将消息通过 stdioTransport 传递给 server
    stdioTransport.emit('message', message);
    
    safeLog(`[TCP] 转发消息到 MCP 服务器: ${message.length} 字节`, 'info');
  } catch (error) {
    safeLog(`[TCP] 处理消息错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
});

// 添加对 TCP 的消息发送支持
// 连接至 stdioTransport 的 write 事件
// @ts-ignore - 直接访问内部事件

// 通过监听提供的stdioTransport写入事件来转发消息
safeLog('设置消息转发监听器');
try {
  // @ts-ignore - 添加对write事件的监听
  stdioTransport.on('write', async (data: string) => {
    try {
      // 转发消息到TCP传输层
      await tcpTransport.send(data);
      safeLog(`[TCP] 发送消息到客户端: ${data.length} 字节`, 'info');
    } catch (error) {
      safeLog(`[TCP] 发送消息错误: ${error instanceof Error ? error.message : String(error)}`, 'warn');
    }
  });
  
  // 如果监听事件失败，尝试直接添加个沉默的钩子
  if (!stdioTransport.on) {
    safeLog('[TCP] 监听器添加失败，尝试使用钩子方式');
    // @ts-ignore - 添加钩子
    const originalWrite = stdioTransport.write?.bind(stdioTransport);
    if (originalWrite) {
      // @ts-ignore - 替换写入方法
      stdioTransport.write = async function(data: string) {
        // 调用原始方法
        const result = await originalWrite(data);
        // 同时转发到TCP
        try {
          await tcpTransport.send(data);
        } catch (err) {
          // 忽略错误
        }
        return result;
      };
    }
  }
} catch (e) {
  safeLog(`[TCP] 设置消息转发时出错: ${e instanceof Error ? e.message : String(e)}`, 'error');
}

// 资源清理函数 - 确保所有资源都被正确关闭
async function cleanupResources() {
  try {
    safeLog('开始清理MCP服务资源...', 'info');
    
    // 关闭TCP服务器
    try {
      await tcpTransport.close();
      safeLog('TCP传输层已关闭', 'info');
    } catch (err) {
      safeLog(`关闭TCP传输层出错: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    
    // 尝试关闭其他资源
    try {
      // 如果WebSearchService实例有需要清理的资源，在这里处理
      // 例如关闭所有未完成的HTTP请求等
      
      safeLog('所有资源已清理完毕', 'info');
    } catch (err) {
      safeLog(`清理其他资源出错: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  } catch (e) {
    // 完全沉默错误，确保不会因为清理过程中的错误而失败
  }
}

// 注册退出处理程序
process.on('exit', () => {
  safeLog('进程退出，执行最终清理', 'info');
  // 同步清理最关键的资源
  // 注意: process.on('exit') 回调中只能执行同步代码
});

// 注册更多退出信号，以便能够执行异步清理
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => {
  process.on(signal, async () => {
    safeLog(`收到${signal}信号，开始清理资源`, 'info');
    await cleanupResources();
    safeLog(`清理完成，退出进程`, 'info');
    
    // 使用延迟退出，确保日志写入完成
    setTimeout(() => process.exit(0), 500);
  });
});

// 退出错误处理
process.on('uncaughtException', async (error) => {
  try {
    safeLog(`未捕获的异常: ${error instanceof Error ? error.stack || error.message : String(error)}`, 'error');
    // 在发生未捕获异常时清理资源，但不退出进程
    await cleanupResources();
    safeLog('异常后资源已清理，服务将继续运行', 'info');
  } catch (e) {
    // 完全沉默错误，避免EPIPE
  }
  // 不退出进程，保持MCP服务继续运行
});

process.on('unhandledRejection', async (reason) => {
  try {
    safeLog(`未处理的Promise拒绝: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`, 'error');
    // 不立即清理资源，只记录错误
  } catch (e) {
    // 完全沉默错误，避免EPIPE
  }
  // 不退出进程，保持MCP服务继续运行
});

// 在 ES 模块环境中直接运行时调用
// Node.js ESM 模块不支持 require.main，因此使用 import.meta.url 检查
const isMainModule = import.meta.url?.endsWith('search-server.js') || 
                     import.meta.url?.endsWith('search-server.ts');
if (isMainModule) {
  startMcpSearchServer().catch((error) => {
    safeLog(`启动失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
  });
}

// 导出服务器实例供测试使用
export { server };