/**
 * 学习轨迹路由
 * 提供学习轨迹相关的API
 */

import { Router } from 'express';
import { 
  analyzeLearningPath,
  generateSuggestions,
  clusterMemories
} from '../services/learning';
import { memoryService } from '../services/learning/memory_service';
import { buildUserKnowledgeGraph } from '../services/learning/topic_graph_builder';
import { log } from '../vite';
import { utils } from '../utils';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';

// 创建路由
const router = Router();

/**
 * 获取用户的学习轨迹分析
 * GET /api/learning-path/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 获取用户 ${userId} 的学习轨迹分析`);
    
    // 设置响应头，禁用缓存
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // 添加时间戳版本以确保每次返回的数据不一样，避免浏览器缓存
    const result = await analyzeLearningPath(userId);
    result.version = new Date().getTime(); // 添加时间戳作为版本号
    
    res.json(result);
  } catch (error) {
    log(`[API] 获取学习轨迹分析出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户的学习建议
 * GET /api/learning-path/:userId/suggestions
 */
router.get('/:userId/suggestions', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const context = req.query.context as string;
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 获取用户 ${userId} 的学习建议`);
    
    const suggestions = await generateSuggestions(userId, context);
    res.json({ suggestions });
  } catch (error) {
    log(`[API] 获取学习建议出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户记忆列表
 * GET /api/learning-path/:userId/memories
 */
router.get('/:userId/memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 解析过滤参数
    const type = req.query.type as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const keywords = req.query.keywords ? (req.query.keywords as string).split(',') : undefined;
    
    log(`[API] 获取用户 ${userId} 的记忆列表`);
    
    // 使用新的记忆服务
    const memories = await memoryService.getMemoriesByFilter(userId, {
      type,
      startDate,
      endDate,
      keywords
    });
    
    res.json({ memories });
  } catch (error) {
    log(`[API] 获取记忆列表出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 查找相似记忆
 * POST /api/learning-path/:userId/similar-memories
 */
router.post('/:userId/similar-memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const { query, limit } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({ error: "无效的请求参数" });
    }
    
    log(`[API] 查找用户 ${userId} 相似记忆: ${query.substring(0, 50)}...`);
    
    try {
      // 使用新的记忆服务
      const memories = await memoryService.findSimilarMemories(query, userId, { limit });
      res.json({ memories });
    } catch (innerError) {
      log(`[API] 解析记忆结果失败: ${innerError}`);
      // 提供更详细的错误信息，方便前端处理
      res.status(500).json({ 
        error: "解析记忆结果失败", 
        details: utils.sanitizeErrorMessage(innerError),
        message: "记忆文件处理过程中出现错误，请稍后再试"
      });
    }
  } catch (error) {
    log(`[API] 查找相似记忆出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 保存记忆
 * POST /api/learning-path/:userId/memory
 */
router.post('/:userId/memory', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const { content, type } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ error: "无效的请求参数" });
    }
    
    log(`[API] 保存用户 ${userId} 的记忆: ${content.substring(0, 50)}...`);
    
    // 使用新的记忆服务
    const memoryId = await memoryService.saveMemory(userId, content, type || 'chat');
    
    res.json({ 
      memory: {
        id: memoryId,
        content,
        type: type || 'chat',
        timestamp: new Date().toISOString(),
        userId
      } 
    });
  } catch (error) {
    log(`[API] 保存记忆出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取记忆聚类
 * GET /api/learning-path/:userId/clusters
 */
router.get('/:userId/clusters', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 获取用户记忆
    const memories = await memoryService.getMemoriesByFilter(userId);
    
    // 如果没有记忆，返回空结果
    if (!memories || memories.length === 0) {
      return res.json({ clusters: [] });
    }
    
    // 解析聚类参数
    const maxClusters = req.query.maxClusters ? parseInt(req.query.maxClusters as string) : undefined;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : undefined;
    const algorithm = req.query.algorithm as any;
    
    log(`[API] 获取用户 ${userId} 的记忆聚类`);
    
    // 执行聚类 - 转换为符合Memory接口的对象
    const memoryObjects = memories.map(memory => ({
      id: memory.id || '',
      content: memory.content,
      type: memory.type,
      timestamp: memory.timestamp,  // 保持字符串格式
      summary: memory.summary,
      keywords: memory.keywords || [],
      userId: memory.userId || userId, // 确保有userId
    }));
    
    const clusters = await clusterMemories(memoryObjects, {
      maxClusters,
      minSimilarity,
      algorithm
    });
    
    res.json({ clusters });
  } catch (error) {
    log(`[API] 获取记忆聚类出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户知识图谱
 * GET /api/learning-path/:userId/knowledge-graph
 */
router.get('/:userId/knowledge-graph', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 检查是否请求强制刷新
    const refresh = req.query.refresh === 'true';
    
    log(`[API] 获取用户 ${userId} 的知识图谱，刷新模式: ${refresh}`);
    
    // 如果是刷新请求，我们将forceRefresh标志传递给生成函数，而不是提前清除缓存
    if (refresh) {
      // 设置响应头，阻止浏览器缓存
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      log(`[API] 请求强制刷新用户 ${userId} 的知识图谱，将跳过使用缓存`);
    } else {
      // 不刷新时，允许短期浏览器缓存（1分钟）
      res.setHeader('Cache-Control', 'max-age=60');
      log(`[API] 正常获取用户 ${userId} 的知识图谱，将优先使用缓存`);
    }
    
    // 生成知识图谱 (使用增强版的topic_graph_builder实现)
    const knowledgeGraph = await buildUserKnowledgeGraph(userId, refresh);
    
    // 添加时间戳版本，帮助区分不同版本的数据
    const response = {
      ...knowledgeGraph,
      version: new Date().getTime()
    };
    
    res.json(response);
  } catch (error) {
    log(`[API] 获取知识图谱出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 修复用户记忆文件
 * POST /api/learning-path/:userId/repair-memories
 */
router.post('/:userId/repair-memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 修复用户 ${userId} 的记忆文件`);
    
    // 运行记忆文件修复脚本，仅处理该用户的文件
    const scriptPath = path.join(process.cwd(), "scripts", "memory_cleanup.py");
    
    // 检查脚本是否存在
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ error: "记忆修复脚本不存在" });
    }
    
    return new Promise<void>((resolve, reject) => {
      const cleanupProcess = spawn("python3", [scriptPath, "--user-id", userId.toString()], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      let output = '';
      let errorOutput = '';
      
      cleanupProcess.stdout.on("data", (data) => {
        const stdoutData = data.toString().trim();
        if (stdoutData) {
          output += stdoutData + '\n';
          log(`[用户记忆修复] ${stdoutData}`);
        }
      });
      
      cleanupProcess.stderr.on("data", (data) => {
        const stderrData = data.toString().trim();
        if (stderrData) {
          errorOutput += stderrData + '\n';
          log(`[用户记忆修复错误] ${stderrData}`);
        }
      });
      
      cleanupProcess.on("close", (code) => {
        if (code === 0) {
          log(`用户${userId}的记忆文件修复完成`);
          res.json({ 
            success: true, 
            message: `用户记忆文件修复成功`, 
            details: output 
          });
          resolve();
        } else {
          log(`用户${userId}的记忆文件修复失败，退出码: ${code}`);
          res.status(500).json({ 
            success: false, 
            error: "记忆文件修复失败", 
            details: errorOutput || "未知错误" 
          });
          resolve();
        }
      });
      
      cleanupProcess.on("error", (err) => {
        log(`启动记忆修复脚本出错: ${err.message}`);
        res.status(500).json({ error: `启动记忆修复脚本出错: ${err.message}` });
        reject(err);
      });
    });
  } catch (error) {
    log(`[API] 修复记忆文件出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 清除知识图谱缓存
 * POST /api/learning-path/:userId/clear-cache
 */
router.post('/:userId/clear-cache', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 清除用户 ${userId} 的知识图谱缓存`);
    
    // 调用存储接口清除缓存
    await storage.clearKnowledgeGraphCache(userId);
    
    res.json({ success: true, message: "知识图谱缓存已清除" });
  } catch (error) {
    log(`[API] 清除知识图谱缓存出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

export default router;