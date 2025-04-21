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

// 创建模拟搜索服务 - 避免导入真实的webSearchService，因为它依赖数据库连接
// 在MCP子进程中，我们使用JSON-RPC通信，因此这里只需返回一个示例结构
const mockWebSearchService = {
  search: async (query: string) => {
    return [
      {
        title: '示例搜索结果',
        snippet: `这是关于"${query}"的示例搜索结果。在实际环境中，此结果将从搜索引擎获取。`,
        url: 'https://example.com/search'
      }
    ];
  },
  searchWithMCP: async (query: string) => {
    return {
      query,
      summary: `这是关于"${query}"的示例MCP搜索摘要。在实际环境中，此结果将从搜索引擎获取并经过AI处理。`,
      relevance: 7.5,
      keyPoints: [
        `"${query}"的关键点1`,
        `"${query}"的关键点2`,
        `"${query}"的关键点3`
      ],
      sources: [
        {
          title: '示例来源1',
          url: 'https://example.com/1',
          content: `关于"${query}"的示例内容1`
        },
        {
          title: '示例来源2',
          url: 'https://example.com/2',
          content: `关于"${query}"的示例内容2`
        }
      ]
    };
  }
};

// 创建 MCP Server (提示：如果SDK有变更，这里可能需要适配)
const server = new McpServer({ 
  name: "mcp-search-server", 
  version: "1.0.0" 
});

// 设置 stdio Transport
const transport = new StdioServerTransport();

// 定义搜索参数的模式
const searchParamsSchema = {
  query: z.string().min(1, "搜索查询不能为空"),
  useMCP: z.boolean().optional().default(true),
  numResults: z.number().int().min(1).max(20).optional().default(5)
};

// 简化：直接注册搜索函数作为工具
// 注意：如果 SDK API 与此不匹配，请使用更底层的 RPC 方式实现
try {
  // @ts-ignore 忽略类型检查以适应可能的 SDK 变更
  server.tool && server.tool("webSearch", async (params: any) => {
    try {
      const { query, useMCP, numResults } = z.object(searchParamsSchema).parse(params);
      
      // 根据 useMCP 标志决定使用哪种搜索方式
      if (useMCP) {
        const mcpResult = await mockWebSearchService.searchWithMCP(query);
        
        if (!mcpResult) {
          return { content: [{ type: "text", text: "未找到相关搜索结果" }] };
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
      } else {
        // 使用基础搜索
        const snippets = await mockWebSearchService.search(query);
        
        if (!snippets || snippets.length === 0) {
          return { content: [{ type: "text", text: "未找到相关搜索结果" }] };
        }
        
        // 格式化结果
        return {
          content: [
            {
              type: "text",
              text: snippets.slice(0, numResults).map((s: {title: string; snippet: string; url: string}, i: number) => 
                `[${i+1}] ${s.title}\n${s.snippet}\n${s.url}`).join("\n\n")
            }
          ]
        };
      }
    } catch (error) {
      console.error("搜索执行出错:", error);
      return {
        content: [{ 
          type: "text", 
          text: `搜索执行失败: ${error instanceof Error ? error.message : String(error)}` 
        }]
      };
    }
  });
} catch (error) {
  console.warn("MCP 工具注册方式可能已更新，错误:", error);
  console.warn("建议查阅最新的 MCP SDK 文档以更新实现");
}

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

// 在 ES 模块环境中直接运行时调用
// Node.js ESM 模块不支持 require.main，因此使用 import.meta.url 检查
const isMainModule = import.meta.url.endsWith('search-server.js') || 
                     import.meta.url.endsWith('search-server.ts');
if (isMainModule) {
  startMcpSearchServer().catch(console.error);
}

// 导出服务器实例供测试使用
export { server };