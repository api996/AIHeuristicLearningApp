/**
 * MCP 服务索引文件
 * 提供 MCP 服务的集中访问点
 */

import { mcpSearchClient } from "./client/search-client";
import { log } from "../../vite";

/**
 * MCP 服务
 * 提供 MCP 协议实现的各种功能
 */
class McpService {
  private initialized = false;
  
  /**
   * 初始化 MCP 服务
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      log("正在初始化 MCP 服务...");
      
      // 初始化搜索客户端
      const searchInitResult = await mcpSearchClient.initialize();
      if (!searchInitResult) {
        log("MCP 搜索客户端初始化失败", "error");
        return false;
      }
      
      this.initialized = true;
      log("MCP 服务已成功初始化");
      return true;
    } catch (error) {
      log(`MCP 服务初始化失败: ${error instanceof Error ? error.message : String(error)}`, "error");
      return false;
    }
  }
  
  /**
   * 执行 MCP 搜索
   */
  async search(query: string, useMCP: boolean = true, numResults: number = 5) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return mcpSearchClient.search(query, useMCP, numResults);
  }
  
  /**
   * 关闭 MCP 服务
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    try {
      await mcpSearchClient.close();
      this.initialized = false;
      log("MCP 服务已关闭");
    } catch (error) {
      log(`关闭 MCP 服务时出错: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
}

// 创建单例实例
export const mcpService = new McpService();

// 导出子模块
export { mcpSearchClient };