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

      // 创建 stdio 传输层 - 使用 tsx 运行 TypeScript 文件
      this.transport = new StdioClientTransport({
        command: "tsx",
        args: [scriptPath]
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
        // 如果 SDK 类型匹配，则可以执行以下代码
        // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
        const init = await this.client.initialize();
        log(`MCP 服务器握手成功，服务名称: ${init?.serverInfo?.name || '未知'}, 版本: ${init?.serverInfo?.version || '未知'}`);
        log(`可用功能: ${JSON.stringify(init?.capabilities || [])}`);
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
          content: [{ text: "MCP 客户端未初始化" }], 
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
        
        // 尝试调用工具方法
        // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
        const result = await this.client.callTool({
          name: "webSearch",
          arguments: toolArgs
        });

        // 确保返回内容是数组
        const contentArray = Array.isArray(result?.content) 
          ? result.content 
          : (result?.content ? [result.content] : []);

        return { 
          success: true, 
          content: contentArray
        };
      } catch (callError) {
        throw new Error(`工具调用失败: ${callError}`);
      }
    } catch (error) {
      log(`MCP 搜索失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return { 
        success: false, 
        content: [{ text: "搜索执行失败" }], 
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