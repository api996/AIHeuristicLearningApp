/**
 * MCP 相关路由
 * 提供 MCP 服务的 API 端点
 */

import express from "express";
import { mcpService } from "../services/mcp";
import { log } from "../vite";

// 创建路由器
const router = express.Router();

/**
 * 初始化 MCP 服务
 * GET /api/mcp/status
 */
router.get("/status", async (req, res) => {
  try {
    const initialized = await mcpService.initialize();
    res.json({
      status: "ok",
      initialized,
      message: initialized ? "MCP 服务已初始化" : "MCP 服务未初始化"
    });
  } catch (error) {
    log(`获取 MCP 状态出错: ${error instanceof Error ? error.message : String(error)}`, "error");
    res.status(500).json({
      status: "error",
      message: "获取 MCP 状态失败",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * 执行 MCP 搜索
 * POST /api/mcp/search
 */
router.post("/search", async (req, res) => {
  try {
    const { query, useMCP = true, numResults = 5 } = req.body;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({
        status: "error",
        message: "搜索查询不能为空且必须是字符串"
      });
    }
    
    // 确保 MCP 服务已初始化
    await mcpService.initialize();
    
    // 执行搜索
    const results = await mcpService.search(
      query, 
      useMCP === false ? false : true, 
      Number(numResults) || 5
    );
    
    res.json({
      status: results.success ? "ok" : "error",
      query,
      usedMCP: useMCP === false ? false : true,
      results: results.content,
      error: results.error
    });
  } catch (error) {
    log(`MCP 搜索出错: ${error instanceof Error ? error.message : String(error)}`, "error");
    res.status(500).json({
      status: "error",
      message: "执行 MCP 搜索失败",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 导出路由器
export default router;