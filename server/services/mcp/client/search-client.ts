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
import { TcpClientTransport } from './tcp-transport';

// 获取当前文件的目录路径（兼容 ESM 模块环境）
const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFilePath);

/**
 * MCP 搜索客户端
 * 实现与 MCP 搜索服务器的通信
 */
export class McpSearchClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | TcpClientTransport | null = null;
  private tcpTransport: TcpClientTransport | null = null;
  private stdioTransport: StdioClientTransport | null = null;
  private initialized = false;
  private serverProcess: ReturnType<typeof spawn> | null = null;
  private useDevCommand = false; // 是否使用开发命令(tsx)而不是生产命令(node)
  private useTcpTransport = false; // 是否使用TCP传输

  /**
   * 初始化 MCP 客户端
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // 检测环境
      const isProduction = process.env.NODE_ENV === 'production';
      
      // 使用绝对路径，解决路径解析问题
      // 针对生产环境，我们需要考虑文件可能被编译到不同位置
      let scriptPath;
      if (isProduction) {
        // 在生产环境中，查找可能的位置
        const possiblePaths = [
          // 标准生产构建路径 (dist/server/...)
          path.join(process.cwd(), 'dist', 'server', 'services', 'mcp', 'server', 'search-server.js'),
          // 直接编译后的路径
          path.join(process.cwd(), 'server', 'services', 'mcp', 'server', 'search-server.js'),
          // 其他可能的路径
          path.join(process.cwd(), 'out', 'server', 'services', 'mcp', 'server', 'search-server.js'),
          // 当前运行目录下查找
          path.join(process.cwd(), 'services', 'mcp', 'server', 'search-server.js'),
          // 备用选项：与客户端同目录
          path.join(currentDir, '..', 'server', 'search-server.js')
        ];
        
        // 在日志中记录所有可能的路径
        log('生产环境: 尝试以下可能的脚本路径:');
        possiblePaths.forEach((p, i) => log(`路径选项 ${i + 1}: ${p}`));
        
        // 导入fs模块检查文件是否存在
        const fs = await import('fs');
        
        // 检查每个路径，使用第一个存在的文件
        let foundPath = false;
        for (const p of possiblePaths) {
          try {
            if (fs.existsSync(p)) {
              scriptPath = p;
              foundPath = true;
              log(`找到有效的脚本路径: ${p}`);
              break;
            }
          } catch (e) {
            // 忽略检查错误
          }
        }
        
        // 如果没有找到任何有效路径，尝试从源代码文件创建
        if (!foundPath) {
          log('未找到可用的JavaScript脚本路径，尝试使用源代码文件');
          // 尝试使用TypeScript文件与node/tsx而非node
          scriptPath = path.join(process.cwd(), 'server', 'services', 'mcp', 'server', 'search-server.ts');
          
          // 检查TypeScript文件是否存在
          try {
            if (fs.existsSync(scriptPath)) {
              log(`将使用TypeScript源文件: ${scriptPath}`);
              // 如果存在TypeScript文件，标记使用开发模式命令
              this.useDevCommand = true;
            } else {
              log(`警告: 无法找到有效的脚本文件，将使用默认路径: ${possiblePaths[0]}`);
              scriptPath = possiblePaths[0];
            }
          } catch (e) {
            log(`检查文件存在时出错: ${e}`);
            scriptPath = possiblePaths[0];
          }
        }
      } else {
        // 开发环境 - 使用标准路径
        scriptPath = path.join(process.cwd(), 'server', 'services', 'mcp', 'server', 'search-server.ts');
      }
      
      log(`当前文件路径: ${currentFilePath}`);
      log(`当前目录: ${currentDir}`);
      log(`环境: ${isProduction ? '生产' : '开发'}`);
      log(`项目根目录: ${process.cwd()}`);
      
      log("初始化 MCP 搜索客户端...");
      log(`MCP 服务器脚本绝对路径: ${scriptPath}`);

      // 注意：由于MCP SDK设计限制，我们必须先使用stdio创建和连接客户端，然后才能添加TCP传输
      // 创建 stdio 传输层 - 根据环境和文件类型选择正确的命令
      // 通常生产环境中使用 node，开发环境使用 tsx
      // 但如果在生产环境中找到的是 .ts 文件，则也使用 tsx
      const command = (isProduction && !this.useDevCommand) ? "node" : "tsx";
      log(`将使用命令: ${command} ${scriptPath}`);
      
      this.stdioTransport = new StdioClientTransport({
        command: command,
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
      
      // 使用标准IO传输初始化
      this.transport = this.stdioTransport;
      
      // 创建 MCP 客户端并连接
      this.client = new Client({ 
        name: "mcp-search-client", 
        version: "1.0.0"
      });
      
      // 连接到服务器
      await this.client.connect(this.transport);
      
      // 现在尝试使用TCP传输
      log('尝试添加TCP传输支持');
      try {
        this.tcpTransport = new TcpClientTransport();
        await this.tcpTransport.connect();
        
        if (this.tcpTransport.isConnected()) {
          log('TCP连接成功，添加TCP传输支持');
          this.useTcpTransport = true;
          
          // 将TCP消息转发到Client
          this.tcpTransport.on('message', (message: string) => {
            // @ts-ignore - 直接调用内部处理方法
            this.stdioTransport.handleMessage?.(message);
          });
        } else {
          log('TCP连接未成功建立，仅使用stdio传输');
          this.useTcpTransport = false;
        }
      } catch (tcpError) {
        log(`TCP连接错误: ${tcpError instanceof Error ? tcpError.message : String(tcpError)}`);
        log('仅使用stdio传输');
        this.useTcpTransport = false;
      }
      
      // 客户端已经连接，初始化握手
      
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

    // 关闭TCP传输
    if (this.tcpTransport) {
      try {
        this.tcpTransport.close().catch(() => {});
      } catch (error) {
        // 忽略关闭错误
      }
      this.tcpTransport = null;
    }
    
    // 关闭stdio传输
    if (this.stdioTransport) {
      try {
        this.stdioTransport.close();
      } catch (error) {
        // 忽略关闭错误
      }
      this.stdioTransport = null;
    }
    
    this.transport = null;

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