/**
 * MCP 搜索客户端实现
 * 基于 Anthropic 的 Model Context Protocol 标准
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { log } from "../../../vite";
import path from "path";

/**
 * MCP 搜索客户端
 * 实现与 MCP 搜索服务器的通信
 */
export class McpSearchClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private initialized = false;
  private serverProcess: any = null;

  /**
   * 初始化 MCP 客户端
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // 获取搜索服务器脚本的绝对路径
      const scriptPath = path.resolve(__dirname, "../server/search-server.js");
      
      log("初始化 MCP 搜索客户端...");
      log(`MCP 服务器脚本路径: ${scriptPath}`);

      // 创建 stdio 传输层
      this.transport = new StdioClientTransport({
        command: "node",
        args: [scriptPath]
      });

      // 创建 MCP 客户端
      this.client = new Client({ 
        name: "mcp-search-client", 
        version: "1.0.0"
      });

      // 连接到服务器
      await this.client.connect(this.transport);
      
      // 执行初始化握手
      const init = await this.client.initialize();
      log(`MCP 服务器握手成功，服务名称: ${init.serverInfo.name}, 版本: ${init.serverInfo.version}`);
      log(`可用功能: ${JSON.stringify(init.capabilities)}`);

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
      const result = await this.client.callTool({
        name: "webSearch",
        arguments: { query, useMCP, numResults }
      });

      return { 
        success: true, 
        content: result.content
      };
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
        this.client.disconnect();
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