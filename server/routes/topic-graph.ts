/**
 * 主题图谱API路由
 * 使用TopicGraphBuilder提供智能主题分析和关系提取
 */
import express from 'express';
import { log } from '../vite';
import { buildUserKnowledgeGraph, testTopicGraphBuilder, diagnoseRelationAPI } from '../services/learning/topic_graph_builder';
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
    
    // 清除图谱缓存
    await db.delete(knowledgeGraphCache).where(eq(knowledgeGraphCache.userId, userId));
    
    // 清除聚类缓存
    try {
      const { clusterCacheService } = await import('../services/learning/cluster_cache_service');
      await clusterCacheService.clearUserClusterCache(userId);
      log(`[TopicGraph] 已清除用户 ${userId} 的聚类缓存`);
    } catch (cacheError) {
      log(`[TopicGraph] 清除聚类缓存失败，将继续使用新算法生成聚类: ${cacheError}`);
      // 清除失败不影响图谱生成流程，继续执行
    }
    
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

// API诊断端点 - 用于诊断关系分析API问题
router.get('/api/topic-graph/diagnose-api', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: '诊断API在生产环境不可用' });
    }
    
    log(`[TopicGraph] 开始API诊断测试`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    // 设置流式响应模式
    res.write('开始诊断API调用问题...\n\n');
    
    // 创建自定义控制台来捕获输出
    const originalConsoleLog = console.log;
    const logs: string[] = [];
    
    console.log = function(message: any, ...optionalParams: any[]) {
      // 原始日志仍然保留
      originalConsoleLog(message, ...optionalParams);
      
      // 只捕获诊断相关的日志
      if (typeof message === 'string' && message.includes('【诊断')) {
        const logMessage = `${message} ${optionalParams.join(' ')}\n`;
        logs.push(logMessage);
        res.write(logMessage);
      }
    };
    
    // 运行诊断
    await diagnoseRelationAPI();
    
    // 恢复原始控制台
    console.log = originalConsoleLog;
    
    // 结束响应
    res.write('\n诊断完成！');
    res.end();
  } catch (error) {
    log(`[TopicGraph] API诊断失败: ${error}`);
    return res.status(500).json({ error: 'API诊断失败' });
  }
});

export default router;