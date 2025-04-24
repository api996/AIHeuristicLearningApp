/**
 * 主题图谱API路由（重定向版）
 * 重定向所有主题图谱请求到知识图谱API
 */
import express from 'express';
import { log } from '../vite';
import { testTopicGraphBuilder } from '../services/learning/topic_graph_builder';

const router = express.Router();

// 获取用户智能主题图谱 - 重定向到知识图谱API
router.get('/api/topic-graph/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    log(`[TopicGraph] 重定向用户 ${userId} 的主题图谱请求到知识图谱API`);
    
    // 调用知识图谱API
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/learning-path/${userId}/knowledge-graph`);
    
    if (!response.ok) {
      throw new Error(`知识图谱API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const graphData = await response.json();
    
    // 添加额外的兼容性属性
    return res.json({
      ...graphData,
      redirected: true, // 标记为重定向的请求
      message: "主题图谱已与知识图谱合并，此为重定向响应"
    });
  } catch (error) {
    log(`[TopicGraph] 重定向主题图谱请求失败: ${error}`);
    return res.status(500).json({ error: '获取主题图谱失败，重定向异常' });
  }
});

// 强制刷新用户主题图谱 - 重定向到知识图谱刷新API
router.post('/api/topic-graph/:userId/refresh', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: '无效的用户ID' });
    }
    
    log(`[TopicGraph] 重定向用户 ${userId} 的主题图谱刷新请求到知识图谱API`);
    
    // 添加时间戳防止缓存
    const timestamp = Date.now();
    
    // 调用知识图谱强制刷新API
    const response = await fetch(
      `http://localhost:${process.env.PORT || 5000}/api/learning-path/${userId}/knowledge-graph?refresh=true&t=${timestamp}`, 
      { method: 'GET' }
    );
    
    if (!response.ok) {
      throw new Error(`知识图谱刷新API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const graphData = await response.json();
    
    log(`[TopicGraph] 成功通过知识图谱API刷新，获取到 ${graphData.nodes?.length || 0} 个节点`);
    
    // 添加额外的兼容性属性
    return res.json({
      ...graphData,
      redirected: true,
      refreshed: true,
      message: "主题图谱已与知识图谱合并，刷新请求已重定向"
    });
  } catch (error) {
    log(`[TopicGraph] 重定向主题图谱刷新请求失败: ${error}`);
    return res.status(500).json({ error: '刷新主题图谱失败，重定向异常' });
  }
});

// 诊断API - 用于显示合并操作的具体信息
router.get('/api/topic-graph/diagnose-api', async (req, res) => {
  try {
    log(`[TopicGraph] 运行主题图谱诊断API`);
    
    return res.json({
      success: true,
      status: "merged",
      message: "主题图谱已成功与知识图谱合并，所有请求将重定向到知识图谱API",
      timestamp: new Date().toISOString(),
      endpoints: {
        original: "/api/topic-graph/:userId",
        redirectTarget: "/api/learning-path/:userId/knowledge-graph" 
      }
    });
  } catch (error) {
    log(`[TopicGraph] 主题图谱诊断失败: ${error}`);
    return res.status(500).json({ error: '主题图谱诊断失败' });
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
      test: true,
      message: "注意：主题图谱已与知识图谱合并，此测试API仍然可用"
    });
  } catch (error) {
    log(`[TopicGraph] 主题图谱测试失败: ${error}`);
    return res.status(500).json({ error: '主题图谱测试失败' });
  }
});

export default router;