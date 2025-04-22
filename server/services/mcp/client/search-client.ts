/**
 * MCP 搜索客户端实现
 * 基于 Anthropic 的 Model Context Protocol 标准
 * 
 * 注意：由于 MCP SDK 接口可能已更新，此实现是基于 MCP 协议规范的简化版本
 * 而非直接使用 SDK 的默认接口，以确保兼容性。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { log } from "../../../vite";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的目录路径（兼容 ESM 模块环境）
const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);

/**
 * MCP 搜索客户端
 * 实现与 MCP 搜索服务器的通信
 */
export class McpSearchClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private initialized = false;
  private serverProcess: ReturnType<typeof spawn> | null = null;

  /**
   * 初始化 MCP 客户端
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // 计算相对于当前文件的路径 - 使用 .ts 扩展名，因为我们在开发环境中使用 tsx
      const relativePath = "../server/search-server.ts";
      const scriptPath = path.join(currentDir, relativePath);
      
      log(`当前文件路径: ${currentFilePath}`);
      log(`当前目录: ${currentDir}`);
      
      log("初始化 MCP 搜索客户端...");
      log(`MCP 服务器脚本路径: ${scriptPath}`);

      // 创建 stdio 传输层 - 使用 tsx 运行 TypeScript 文件，并传递关键环境变量
      this.transport = new StdioClientTransport({
        command: "tsx",
        args: [scriptPath],
        env: {
          ...process.env,
          GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
          DATABASE_URL: process.env.DATABASE_URL || "",
          PGUSER: process.env.PGUSER || "",
          PGDATABASE: process.env.PGDATABASE || "",
          PGPORT: process.env.PGPORT || "",
          PGHOST: process.env.PGHOST || "",
          PGPASSWORD: process.env.PGPASSWORD || ""
        }
      });

      // 创建 MCP 客户端
      this.client = new Client({ 
        name: "mcp-search-client", 
        version: "1.0.0"
      });

      // 连接到服务器
      await this.client.connect(this.transport);
      
      // 初始化握手 (使用try/catch捕获可能的错误)
      try {
        // 新的MCP SDK版本可能不需要或不支持显式初始化
        // 尝试获取服务器信息而不是调用initialize
        // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
        if (typeof this.client.initialize === 'function') {
          const init = await this.client.initialize();
          log(`MCP 服务器握手成功，服务名称: ${init?.serverInfo?.name || '未知'}, 版本: ${init?.serverInfo?.version || '未知'}`);
          log(`可用功能: ${JSON.stringify(init?.capabilities || [])}`);
        } else if (typeof this.client.getServerInfo === 'function') {
          // 尝试使用getServerInfo作为替代
          const serverInfo = await this.client.getServerInfo();
          log(`MCP 服务器信息获取成功: ${JSON.stringify(serverInfo)}`);
        } else {
          // 如果两种方法都不存在，假设不需要初始化
          log(`MCP SDK版本不支持显式初始化，将直接使用已连接的客户端`);
        }
      } catch (initError) {
        log(`MCP 初始化握手失败，继续执行: ${initError}`);
        // 继续执行，因为某些 SDK 版本可能不需要显式初始化
        // 或者初始化方法可能已改变
      }

      this.initialized = true;
      return true;
    } catch (error) {
      log(`MCP 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      this.cleanup();
      return false;
    }
  }

  /**
   * 执行 MCP 搜索
   * @param query 搜索查询
   * @param useMCP 是否使用 MCP 搜索 (默认 true)
   * @param numResults 结果数量 (默认 5)
   */
  async search(
    query: string, 
    useMCP: boolean = true, 
    numResults: number = 5
  ): Promise<{ success: boolean; content: any[]; error?: string }> {
    if (!this.initialized || !this.client) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return { 
          success: false, 
          content: [{ type: "text", text: "MCP 客户端未初始化" }], 
          error: "客户端初始化失败" 
        };
      }
    }

    try {
      log(`执行 MCP 搜索: "${query}", 使用 MCP: ${useMCP}, 结果数量: ${numResults}`);
      
      // 调用搜索工具
      try {
        // 添加调试日志
        log(`正在调用 MCP 工具，参数: ${JSON.stringify({ query, useMCP, numResults })}`);
        
        // 创建正确的参数对象
        const toolArgs = { query, useMCP, numResults };
        log(`工具参数结构: ${JSON.stringify(toolArgs)}`);
        log(`参数类型: query=${typeof query}, useMCP=${typeof useMCP}, numResults=${typeof numResults}`);
        
        // 尝试调用工具方法，但先进行额外的日志记录
        log(`正在序列化工具参数: ${JSON.stringify(toolArgs)}`);
        
        // 确保参数是正确的格式
        const finalArgs = {
          query: String(query),
          useMCP: Boolean(useMCP),
          numResults: Number(numResults)
        };
        
        log(`已优化的参数: ${JSON.stringify(finalArgs)}`);
        
        // 尝试不同的参数传递方式
        // 直接使用query参数，避免嵌套结构
        try {
          log(`尝试直接使用query参数调用工具: query=${query}`);
          
          // 直接传递query参数，避免嵌套结构导致的问题
          // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
          let result;
          // 首先检查callTool方法是否存在
          if (typeof this.client.callTool === 'function') {
            result = await this.client.callTool({
              name: "webSearch",
              arguments: {
                query: query, // 仅传递查询字符串
                useMCP: useMCP,
                numResults: numResults
              }
            });
          } else if (typeof this.client.runTool === 'function') {
            // 尝试替代方法
            result = await this.client.runTool("webSearch", {
              query: query,
              useMCP: useMCP,
              numResults: numResults
            });
          } else {
            throw new Error("MCP客户端不支持工具调用方法");
          }
          
          return { 
            success: true, 
            content: Array.isArray(result?.content) 
              ? result.content 
              : (result?.content ? [result.content] : [])
          };
        } catch (err) {
          log(`工具调用失败(直接参数): ${err}`, 'warn');
          
          // 尝试策略2：使用单个字符串参数
          try {
            log(`尝试使用单个字符串参数: ${query}`);
            // @ts-ignore 忽略类型检查
            const simpleResult = await this.client.callTool({
              name: "webSearch",
              arguments: { query: query } // 确保传递对象而非字符串
            });
            
            return {
              success: true,
              content: Array.isArray(simpleResult?.content)
                ? simpleResult.content
                : (simpleResult?.content ? [simpleResult.content] : [])
            };
          } catch (err2) {
            log(`工具调用失败(单字符串): ${err2}`, 'warn');
            
            // 最后一种尝试：使用runTool方法
            try {
              log(`尝试使用runTool方法: ${query}`);
              // @ts-ignore 忽略类型检查
              const altResult = await this.client.runTool("webSearch", {
                query: query,
                useMCP: useMCP,
                numResults: numResults
              });
              
              return {
                success: true,
                content: Array.isArray(altResult?.content)
                  ? altResult.content
                  : (altResult?.content ? [altResult.content] : [])
              };
            } catch (err3) {
              log(`工具调用全部失败，返回错误信息`, 'error');
              throw err; // 将首次错误抛出
            }
          }
        }
      } catch (callError) {
        throw new Error(`工具调用失败: ${callError}`);
      }
    } catch (error) {
      log(`MCP 搜索失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return { 
        success: false, 
        content: [{ type: "text", text: "搜索执行失败" }], 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    this.cleanup();
    this.initialized = false;
    log("MCP 搜索客户端已关闭");
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.client) {
      try {
        // 尝试多种可能的方法名关闭连接
        try {
          // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
          this.client.disconnect();
        } catch (e1) {
          try {
            // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
            this.client.close();
          } catch (e2) {
            // 忽略所有关闭错误
          }
        }
      } catch (error) {
        // 忽略断开连接错误
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        this.transport.close();
      } catch (error) {
        // 忽略关闭错误
      }
      this.transport = null;
    }

    if (this.serverProcess) {
      try {
        this.serverProcess.kill();
      } catch (error) {
        // 忽略进程终止错误
      }
      this.serverProcess = null;
    }
  }
}

// 创建单例实例
export const mcpSearchClient = new McpSearchClient();