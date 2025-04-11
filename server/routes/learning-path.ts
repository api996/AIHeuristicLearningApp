/**
 * 学习轨迹路由
 * 提供学习轨迹相关的API
 */

import { Router } from 'express';
import { 
  analyzeLearningPath,
  generateSuggestions,
  saveMemory,
  findSimilarMemories,
  getMemoriesByFilter,
  clusterMemories
} from '../services/learning';
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
    const types = req.query.types ? (req.query.types as string).split(',') : undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const keywords = req.query.keywords ? (req.query.keywords as string).split(',') : undefined;
    
    log(`[API] 获取用户 ${userId} 的记忆列表`);
    
    const memories = await getMemoriesByFilter({
      userId,
      types,
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
    
    const memories = await findSimilarMemories(query, userId, { limit });
    res.json({ memories });
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
    
    const memory = await saveMemory({
      content,
      type: type || 'chat',
      timestamp: new Date().toISOString(),
      userId
    });
    
    res.json({ memory });
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
    const memories = await getMemoriesByFilter({ userId });
    
    // 如果没有记忆，返回空结果
    if (!memories || memories.length === 0) {
      return res.json({ clusters: [] });
    }
    
    // 解析聚类参数
    const maxClusters = req.query.maxClusters ? parseInt(req.query.maxClusters as string) : undefined;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : undefined;
    const algorithm = req.query.algorithm as any;
    
    log(`[API] 获取用户 ${userId} 的记忆聚类`);
    
    // 执行聚类
    const clusters = await clusterMemories(memories, {
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