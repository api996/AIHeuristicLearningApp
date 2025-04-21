/**
 * MCP 搜索服务器实现
 * 基于 Anthropic 的 Model Context Protocol 标准
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { webSearchService } from "../../web-search";

// 严格校验 JSON-RPC 消息格式
const RpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.any().optional()
});

// 创建 MCP Server
const server = new McpServer({ 
  name: "mcp-search-server", 
  version: "1.0.0" 
});

// 设置 stdio Transport，并校验入站消息
const transport = new StdioServerTransport();
transport.on("message", (msg: unknown) => {
  const parsed = RpcRequestSchema.safeParse(msg);
  if (!parsed.success) {
    console.error("无效的 JSON-RPC 消息:", parsed.error.format());
    throw new Error("MCP 协议校验失败");
  }
});

// 定义 webSearch 工具：调用现有的 webSearchService
const WebSearchInput = z.object({
  query: z.string().min(1, "搜索查询不能为空"),
  useMCP: z.boolean().optional().default(true),
  numResults: z.number().int().min(1).max(20).optional().default(5)
});

server.tool(
  "webSearch",
  WebSearchInput,
  async (args) => {
    const { query, useMCP, numResults } = WebSearchInput.parse(args);
    
    try {
      // 根据 useMCP 标志决定使用哪种搜索方式
      if (useMCP) {
        const mcpResult = await webSearchService.searchWithMCP(query);
        
        if (!mcpResult) {
          return {
            content: [{ 
              type: "text", 
              text: "未找到相关搜索结果" 
            }]
          };
        }
        
        // 格式化 MCP 结果为内容数组
        const formattedResults = [
          {
            type: "text",
            text: `## ${query} - 搜索摘要\n\n${mcpResult.summary}\n\n**相关性评分**: ${mcpResult.relevance}/10`
          },
          {
            type: "text",
            text: "## 关键信息点\n\n" + mcpResult.keyPoints.map((point, i) => `${i+1}. ${point}`).join("\n\n")
          }
        ];
        
        // 添加来源
        mcpResult.sources.forEach((source, i) => {
          formattedResults.push({
            type: "text",
            text: `## 来源 ${i+1}: ${source.title}\n${source.content}\n来源: ${source.url}`
          });
        });
        
        return { content: formattedResults };
      } else {
        // 使用基础搜索
        const snippets = await webSearchService.search(query);
        
        if (!snippets || snippets.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: "未找到相关搜索结果" 
            }]
          };
        }
        
        // 格式化基础搜索结果
        const formattedResults = snippets.slice(0, numResults).map((snippet, i) => ({
          type: "text",
          text: `${i+1}. ${snippet.title}\n${snippet.snippet}\n${snippet.url}`
        }));
        
        return { content: formattedResults };
      }
    } catch (error) {
      console.error("MCP 搜索工具错误:", error);
      return {
        content: [{ 
          type: "text", 
          text: `搜索执行失败: ${error instanceof Error ? error.message : String(error)}` 
        }]
      };
    }
  }
);

// 可选：暴露服务信息资源
server.resource(
  "info",
  {}, // 简单 ResourceTemplate 配置
  async () => ({
    contents: [{ uri: "info://version", text: `version ${server.version}` }]
  })
);

// 启动服务
export async function startMcpSearchServer() {
  try {
    await server.connect(transport);
    console.log("MCP 搜索服务已启动，监听 stdio...");
    return { success: true };
  } catch (error) {
    console.error("MCP 服务启动失败:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// 如果直接运行此文件则启动服务
if (require.main === module) {
  startMcpSearchServer().catch(console.error);
}

// 导出服务器实例供测试使用
export { server };