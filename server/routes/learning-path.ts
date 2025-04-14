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
import { memoryService, StorageMode, MemoryItem } from '../services/learning/memory_service';
import { log } from '../vite';
import { utils } from '../utils';

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
    
    const result = await analyzeLearningPath(userId);
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

export default router;