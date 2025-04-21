/**
 * MCP API 路由
 * 提供标准 MCP 搜索服务的 REST API 端点
 */

import { Router } from 'express';
import { searchWithMCP, initializeMCP } from '../services/mcp';
import { z } from 'zod';

const router = Router();

// 确保 MCP 服务已初始化
let mcpInitialized = false;
const initMcpService = async () => {
  if (!mcpInitialized) {
    mcpInitialized = await initializeMCP();
    console.log(`[MCP API] MCP 服务初始化${mcpInitialized ? '成功' : '失败'}`);
  }
  return mcpInitialized;
};

// 延迟初始化 MCP 服务
setTimeout(async () => {
  await initMcpService();
}, 2000);

// 搜索请求验证模式
const searchRequestSchema = z.object({
  query: z.string().min(1, "搜索查询不能为空"),
  useMCP: z.boolean().optional().default(true),
  numResults: z.number().int().min(1).max(10).optional().default(5)
});

/**
 * @api {post} /api/mcp/search 执行 MCP 搜索
 * @apiName McpSearch
 * @apiGroup MCP
 * @apiDescription 使用 MCP 协议执行搜索
 * 
 * @apiParam {String} query 搜索查询内容
 * @apiParam {Boolean} [useMCP=true] 是否使用 MCP 结构化结果
 * @apiParam {Number} [numResults=5] 返回结果数量 (1-10)
 * 
 * @apiSuccess {Boolean} success 搜索是否成功
 * @apiSuccess {Array} content 搜索结果内容
 * @apiSuccess {String} [error] 错误信息 (如果搜索失败)
 */
router.post('/search', async (req, res) => {
  try {
    // 验证请求参数
    const validationResult = searchRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        details: validationResult.error.format()
      });
    }
    
    const { query, useMCP, numResults } = validationResult.data;
    
    // 确保 MCP 服务已初始化
    const isInitialized = await initMcpService();
    if (!isInitialized) {
      return res.status(500).json({
        success: false,
        error: 'MCP 服务未初始化'
      });
    }
    
    // 执行搜索
    console.log(`[MCP API] 执行搜索: "${query}", 使用MCP=${useMCP}, 结果数量=${numResults}`);
    
    // 导入 WebSearchService
    const { WebSearchService } = await import('../services/web-search');
    const webSearchService = new WebSearchService();
    
    let result;
    if (useMCP) {
      try {
        console.log(`[MCP API] 使用自定义MCP处理查询: "${query}"`);
        
        // 使用可靠的自定义MCP实现
        const mcpResult = await webSearchService.searchWithMCP(query);
        result = { 
          success: true, 
          content: [{ 
            type: "text",
            text: `## ${query} - 搜索摘要\n\n${mcpResult.summary}\n\n相关性: ${mcpResult.relevance}/10\n\n` +
                  `关键信息点:\n${mcpResult.keyPoints.map((p: string) => `• ${p}`).join("\n")}\n\n` +
                  `来源:\n${mcpResult.sources.map((s: any, i: number) => 
                    `[${i+1}] ${s.title} - ${s.url}\n${s.content}`).join("\n\n")}`
          }]
        };
      } catch (error) {
        console.warn(`[MCP API] 自定义MCP模式失败，切换到基础搜索模式: ${error}`);
        
        // 如果MCP失败，回退到基础搜索
        const snippets = await webSearchService.search(query);
        result = {
          success: true,
          content: [{
            type: "text",
            text: `## ${query} - 基础搜索结果 (MCP模式失败，已切换)\n\n` + 
                  snippets.slice(0, numResults).map((s: any, i: number) => 
                  `[${i+1}] ${s.title}\n${s.snippet}\n${s.url}`).join("\n\n")
          }]
        };
      }
    } else {
      // 使用基础搜索
      console.log(`[MCP API] 使用基础搜索处理查询: "${query}"`);
      const snippets = await webSearchService.search(query);
      result = {
        success: true,
        content: [{
          type: "text",
          text: `## ${query} - 基础搜索结果\n\n` + 
                snippets.slice(0, numResults).map((s: any, i: number) => 
                `[${i+1}] ${s.title}\n${s.snippet}\n${s.url}`).join("\n\n")
        }]
      };
    }
    
    // 返回结果
    return res.json(result);
  } catch (error) {
    console.error('[MCP API] 搜索执行错误:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @api {get} /api/mcp/status 获取 MCP 服务状态
 * @apiName McpStatus
 * @apiGroup MCP
 * @apiDescription 检查 MCP 服务的状态
 * 
 * @apiSuccess {Boolean} initialized MCP 服务是否已初始化
 */
router.get('/status', async (req, res) => {
  res.json({
    initialized: mcpInitialized
  });
});

export default router;