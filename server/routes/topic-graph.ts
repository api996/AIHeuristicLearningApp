/**
 * 主题图谱API路由（直接使用knowledge_graph_cache表）
 * 使用专用的knowledgeGraphCache表存储知识图谱数据
 */
import express from 'express';
import { log } from '../vite';
import { buildUserKnowledgeGraph, testTopicGraphBuilder } from '../services/learning/topic_graph_builder';
import { utils } from '../utils';

const router = express.Router();

// 诊断API - 用于显示当前API状态
router.get('/diagnose-api', (req, res) => {
  try {
    log(`[TopicGraph] 运行主题图谱诊断API`);
    
    return res.json({
      success: true,
      status: "direct",
      message: "主题图谱API现在直接使用knowledge_graph_cache表存储数据",
      timestamp: new Date().toISOString(),
      endpoints: {
        main: "/api/topic-graph/:userId",
        refresh: "/api/topic-graph/:userId/refresh",
        test: "/api/topic-graph/test"
      }
    });
  } catch (error) {
    log(`[TopicGraph] 主题图谱诊断失败: ${error}`);
    return res.status(500).json({ error: '主题图谱诊断失败' });
  }
});

// 获取用户智能主题图谱 - 直接调用buildUserKnowledgeGraph
router.get('/:userId', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    // 检查是否请求强制刷新
    const refresh = req.query.refresh === 'true';
    
    log(`[TopicGraph] 获取用户 ${userId} 的主题图谱，刷新模式: ${refresh}`);
    
    // 缓存控制
    if (refresh) {
      // 刷新时禁用缓存
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // 不刷新时，允许短期浏览器缓存（1分钟）
      res.setHeader('Cache-Control', 'max-age=60');
    }
    
    // 直接调用buildUserKnowledgeGraph函数
    const graphData = await buildUserKnowledgeGraph(userId, refresh);
    
    // 添加时间戳版本
    const response = {
      ...graphData,
      version: new Date().getTime()
    };
    
    return res.json(response);
  } catch (error) {
    log(`[TopicGraph] 获取主题图谱失败: ${error}`);
    return res.status(500).json({ error: '获取主题图谱失败' });
  }
});

// 强制刷新用户主题图谱 - 直接调用buildUserKnowledgeGraph
router.post('/:userId/refresh', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    log(`[TopicGraph] 强制刷新用户 ${userId} 的主题图谱`);
    
    // 设置缓存控制头
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // 直接调用buildUserKnowledgeGraph函数，强制刷新 
    const graphData = await buildUserKnowledgeGraph(userId, true);
    
    log(`[TopicGraph] 成功刷新主题图谱，生成了 ${graphData.nodes?.length || 0} 个节点`);
    
    // 添加响应数据
    return res.json({
      ...graphData,
      refreshed: true,
      timestamp: new Date().getTime(),
      message: "主题图谱已成功刷新并存储到知识图谱缓存表"
    });
  } catch (error) {
    log(`[TopicGraph] 刷新主题图谱失败: ${error}`);
    return res.status(500).json({ error: '刷新主题图谱失败' });
  }
});

// 测试API - 仅在开发环境可用
router.get('/test', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: '测试API在生产环境不可用' });
    }
    
    log(`[TopicGraph] 运行主题图谱测试`);
    const testResult = await testTopicGraphBuilder();
    
    return res.json({
      ...testResult,
      test: true,
      message: "主题图谱测试成功，数据将存储到知识图谱缓存表"
    });
  } catch (error) {
    log(`[TopicGraph] 主题图谱测试失败: ${error}`);
    return res.status(500).json({ error: '主题图谱测试失败' });
  }
});

export default router;