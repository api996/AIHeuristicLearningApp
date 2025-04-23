/**
 * 主题图谱API路由
 * 使用TopicGraphBuilder提供智能主题分析和关系提取
 */
import express from 'express';
import { log } from '../vite';
import { buildUserKnowledgeGraph, testTopicGraphBuilder } from '../services/learning/topic_graph_builder';
import { db } from '../db';
import { knowledgeGraphCache } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// 获取用户智能主题图谱
router.get('/api/topic-graph/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    // 首先尝试从缓存获取
    const [existingGraph] = await db.select()
      .from(knowledgeGraphCache)
      .where(eq(knowledgeGraphCache.userId, userId));
    
    // 如果缓存存在且未过期，直接返回
    if (existingGraph && existingGraph.expiresAt && new Date() < new Date(existingGraph.expiresAt)) {
      log(`[TopicGraph] 从缓存获取用户 ${userId} 的主题图谱`);
      return res.json({
        nodes: existingGraph.nodes,
        links: existingGraph.links,
        version: existingGraph.version,
        fromCache: true
      });
    }
    
    // 缓存不存在或已过期，生成新图谱
    log(`[TopicGraph] 为用户 ${userId} 生成新的主题图谱`);
    const graphData = await buildUserKnowledgeGraph(userId);
    
    return res.json({
      ...graphData,
      fromCache: false
    });
  } catch (error) {
    log(`[TopicGraph] 获取主题图谱失败: ${error}`);
    return res.status(500).json({ error: '获取主题图谱失败' });
  }
});

// 强制刷新用户主题图谱
router.post('/api/topic-graph/:userId/refresh', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    // 清除缓存并生成新图谱
    await db.delete(knowledgeGraphCache).where(eq(knowledgeGraphCache.userId, userId));
    
    log(`[TopicGraph] ==========================================`);
    log(`[TopicGraph] 强制刷新用户 ${userId} 的主题图谱 - 开始`);
    log(`[TopicGraph] ==========================================`);
    
    const graphData = await buildUserKnowledgeGraph(userId);
    
    // 记录一些结果数据，以便于调试
    log(`[TopicGraph] 刷新完成，获取到 ${graphData.nodes.length} 个节点`);
    if (graphData.nodes.length > 0) {
      const nodeTypes = graphData.nodes
        .map(node => node.category)
        .filter((v, i, a) => a.indexOf(v) === i); // 去重
      
      log(`[TopicGraph] 节点类型: ${nodeTypes.join(', ')}`);
      
      // 记录所有节点的标签
      const nodeLabels = graphData.nodes.map(node => 
        `${node.label}(${node.category})`
      ).join(', ');
      
      log(`[TopicGraph] 节点标签: ${nodeLabels}`);
    }
    
    log(`[TopicGraph] ==========================================`);
    log(`[TopicGraph] 强制刷新用户 ${userId} 的主题图谱 - 完成`);
    log(`[TopicGraph] ==========================================`);
    
    return res.json({
      ...graphData,
      fromCache: false,
      refreshed: true
    });
  } catch (error) {
    log(`[TopicGraph] 刷新主题图谱失败: ${error}`);
    return res.status(500).json({ error: '刷新主题图谱失败' });
  }
});

// 测试API - 仅在开发环境可用
router.get('/api/topic-graph/test', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: '测试API在生产环境不可用' });
    }
    
    log(`[TopicGraph] 运行主题图谱测试`);
    const testResult = await testTopicGraphBuilder();
    
    return res.json({
      ...testResult,
      test: true
    });
  } catch (error) {
    log(`[TopicGraph] 主题图谱测试失败: ${error}`);
    return res.status(500).json({ error: '主题图谱测试失败' });
  }
});

export default router;