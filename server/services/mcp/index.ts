/**
 * MCP (Model Context Protocol) 服务
 * 基于 Anthropic 的 MCP 标准实现
 * 
 * 该模块整合了MCP客户端和服务器，为模型提供基于MCP协议的结构化搜索功能
 */

import { mcpSearchClient } from './client/search-client';
import { server as mcpServer } from './server/search-server';

// 导出客户端实例
export { mcpSearchClient };

// 导出服务器实例
export { mcpServer };

/**
 * 执行MCP搜索
 * @param query 搜索查询
 * @param useMCP 是否使用MCP结构化结果 (默认true)
 * @param numResults 结果数量 (默认5)
 * @returns 搜索结果
 */
export async function searchWithMCP(
  query: string,
  useMCP: boolean = true,
  numResults: number = 5
): Promise<{ success: boolean; content: any[]; error?: string }> {
  return mcpSearchClient.search(query, useMCP, numResults);
}

/**
 * 初始化MCP服务
 * @returns 初始化结果
 */
export async function initializeMCP(): Promise<boolean> {
  return mcpSearchClient.initialize();
}

/**
 * 关闭MCP服务
 */
export async function closeMCP(): Promise<void> {
  return mcpSearchClient.close();
}

// 默认导出
export default {
  searchWithMCP,
  initializeMCP,
  closeMCP,
  client: mcpSearchClient,
  server: mcpServer
};