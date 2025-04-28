/**
 * 主题图谱API路由（直接使用knowledge_graph_cache表）
 * 使用专用的knowledgeGraphCache表存储知识图谱数据
 */
import express from 'express';
import { log } from '../vite';
import { buildUserKnowledgeGraph, testTopicGraphBuilder } from '../services/learning/topic_graph_builder';
import { utils } from '../utils';
import { db } from "../db";
import { knowledgeGraphCache, memories } from "@shared/schema";
import { eq, gt, and, desc, sql } from "drizzle-orm";

const router = express.Router();

// 诊断API - 用于显示当前API状态
router.get('/diagnose-api', (req, res) => {
  try {
    log(`[TopicGraph] 运行主题图谱诊断API`);
    
    // 设置内容类型头确保正确编码中文字符
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
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
    
    // 缓存控制和内容类型
    if (refresh) {
      // 刷新时禁用缓存
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // 不刷新时，允许短期浏览器缓存（1分钟）
      res.setHeader('Cache-Control', 'max-age=60');
    }
    // 设置内容类型以确保正确编码中文字符
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
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

// 智能刷新用户主题图谱 - 按需生成，多级缓存策略
router.post('/:userId/refresh', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    log(`[TopicGraph] 接收到用户 ${userId} 的图谱刷新请求`);
    
    // 设置缓存控制和内容类型头
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // 1. 先检查是否有缓存数据，及是否有足够的新数据需要刷新
    // 使用已经导入的db和schema
    // 不需要重新导入
    
    // 获取当前缓存
    const cachedGraph = await db.select()
      .from(knowledgeGraphCache)
      .where(eq(knowledgeGraphCache.userId, userId))
      .orderBy(desc(knowledgeGraphCache.version))
      .limit(1);
    
    const hasCache = cachedGraph.length > 0 && 
                     cachedGraph[0].nodes && 
                     cachedGraph[0].links;
    
    // 检查是否有足够多的新记忆，以决定是否需要完全刷新
    let needFullRefresh = false;
    
    if (hasCache) {
      const MEMORY_THRESHOLD = 5; // 超过5条新记忆才做完整刷新
      const lastCacheTime = cachedGraph[0].updatedAt || cachedGraph[0].createdAt;
      
      // 将日期转为字符串进行比较，避免类型问题
      const lastCacheTimeStr = lastCacheTime.toISOString();
      
      const newMemories = await db.select({ count: sql`count(*)` })
        .from(memories)
        .where(
          and(
            eq(memories.userId, userId),
            sql`${memories.createdAt}::timestamp > ${lastCacheTimeStr}::timestamp`
          )
        );
      
      const newMemoryCount = Number(newMemories[0]?.count || 0);
      log(`[TopicGraph] 检测到 ${newMemoryCount} 条新记忆（缓存后添加）`);
      
      needFullRefresh = newMemoryCount >= MEMORY_THRESHOLD;
      
      if (!needFullRefresh) {
        log(`[TopicGraph] 记忆变化不足（${newMemoryCount} < ${MEMORY_THRESHOLD}），只进行部分更新`);
      } else {
        log(`[TopicGraph] 检测到足够的新记忆(${newMemoryCount})，执行完整刷新`);
      }
    } else {
      // 没有缓存时需要完整刷新
      needFullRefresh = true;
      log(`[TopicGraph] 未找到缓存数据，将执行完整刷新`);
    }
    
    // 2. 根据判断结果决定刷新方式
    let graphData;
    
    try {
      if (needFullRefresh) {
        // 设置超时，避免请求卡住
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("刷新操作超时")), 45000); // 45秒超时
        });
        
        // 实际刷新操作
        const refreshPromise = buildUserKnowledgeGraph(userId, true);
        
        // 竞争执行，谁先完成用谁的结果
        graphData = await Promise.race([refreshPromise, timeoutPromise]) as any;
        log(`[TopicGraph] 完整刷新成功，生成了 ${graphData.nodes?.length || 0} 个节点`);
      } else {
        // 只做轻量级刷新，使用现有聚类结果生成新关系（或不做大变动）
        graphData = await buildUserKnowledgeGraph(userId, false);
        log(`[TopicGraph] 部分更新成功，保留了 ${graphData.nodes?.length || 0} 个节点`);
      }
    } catch (buildError) {
      log(`[TopicGraph] 生成图谱时出错: ${buildError}`);
      
      // 失败时优先使用缓存数据
      if (hasCache) {
        log(`[TopicGraph] 使用现有缓存作为备选方案`);
        graphData = {
          nodes: cachedGraph[0].nodes,
          links: cachedGraph[0].links
        };
      } else {
        // 如果真的没有缓存，尝试最后一次非强制刷新
        log(`[TopicGraph] 没有可用缓存，尝试非强制生成`);
        graphData = await buildUserKnowledgeGraph(userId, false);
      }
    }
    
    // 添加响应数据
    return res.json({
      ...graphData,
      refreshed: true,
      timestamp: new Date().getTime(),
      message: "主题图谱已刷新并存储到知识图谱缓存表",
      isFullRefresh: needFullRefresh // 告诉前端这是否是完整刷新
    });
  } catch (error) {
    log(`[TopicGraph] 刷新主题图谱失败: ${error}`);
    
    // 当所有尝试都失败时，返回更友好的错误信息
    return res.status(500).json({ 
      error: '刷新主题图谱暂时失败，请稍后再试',
      timestamp: new Date().getTime(),
      reason: error instanceof Error ? error.message : String(error)
    });
  }
});

// 测试API - 仅在开发环境可用
router.get('/test', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: '测试API在生产环境不可用' });
    }
    
    log(`[TopicGraph] 运行主题图谱测试`);
    
    // 设置内容类型头确保正确编码
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
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