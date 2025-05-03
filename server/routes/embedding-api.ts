/**
 * 嵌入向量 API路由
 * 提供快速生成嵌入向量的HTTP端点
 * 使用统一的嵌入服务管理器处理所有请求
 */

import { Router } from 'express';
import { embeddingManager } from '../services/embedding/embedding_manager';
import { Pool } from '@neondatabase/serverless'; 

const router = Router();

// 获取数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 初始化日志
console.log('嵌入向量 API路由已初始化');

// 嵌入生成端点
router.post('/embed', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '缺少必要的文本参数'
      });
    }
    
    // 使用统一的嵌入管理器生成嵌入
    const embedding = await embeddingManager.generateEmbedding(text);
    
    if (!embedding || embedding.length !== 3072) {
      return res.status(500).json({
        success: false,
        error: `嵌入生成失败或维度不正确 (实际维度: ${embedding ? embedding.length : 0}, 期望: 3072)`
      });
    }
    
    return res.json({
      success: true,
      embedding,
      dimensions: embedding.length
    });
    
  } catch (error: any) {
    console.error('嵌入API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成嵌入时发生未知错误'
    });
  }
});

// 根据记忆ID生成嵌入向量
router.post('/process-memory/:memoryId', async (req, res) => {
  try {
    const { memoryId } = req.params;
    
    if (!memoryId) {
      return res.status(400).json({
        success: false,
        error: '缺少记忆ID'
      });
    }
    
    // 将记忆添加到处理队列
    embeddingManager.addToProcessingQueue(parseInt(memoryId));
    
    return res.json({
      success: true,
      memoryId,
      message: `记忆已添加到处理队列，将异步生成嵌入向量`
    });
    
  } catch (error: any) {
    console.error('处理记忆嵌入错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理记忆嵌入时发生未知错误'
    });
  }
});

// 处理单个或多个记忆ID的嵌入
router.post('/process', async (req, res) => {
  try {
    const { memoryId, memoryIds } = req.body;
    const idsToProcess: number[] = [];
    
    // 处理单个ID
    if (memoryId && !isNaN(parseInt(memoryId))) {
      idsToProcess.push(parseInt(memoryId));
    }
    
    // 处理多个ID
    if (Array.isArray(memoryIds) && memoryIds.length > 0) {
      memoryIds.forEach(id => {
        if (!isNaN(parseInt(id)) && !idsToProcess.includes(parseInt(id))) {
          idsToProcess.push(parseInt(id));
        }
      });
    }
    
    if (idsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: '未提供有效的记忆ID'
      });
    }
    
    // 将所有ID添加到处理队列
    idsToProcess.forEach(id => {
      embeddingManager.addToProcessingQueue(id);
    });
    
    return res.json({
      success: true,
      count: idsToProcess.length,
      memoryIds: idsToProcess,
      message: `已将${idsToProcess.length}条记忆添加到处理队列`
    });
    
  } catch (error: any) {
    console.error('处理记忆嵌入错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理记忆嵌入时发生未知错误'
    });
  }
});

// 手动触发检查未处理的记忆
router.post('/trigger-check', async (req, res) => {
  try {
    embeddingManager.triggerCheck();
    
    return res.json({
      success: true,
      message: '已触发检查未处理的记忆'
    });
  } catch (error: any) {
    console.error('触发检查出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '触发检查时发生未知错误'
    });
  }
});

// 获取服务状态
router.get('/status', async (req, res) => {
  try {
    const status = embeddingManager.getStatus();
    
    return res.json({
      success: true,
      status
    });
  } catch (error: any) {
    console.error('获取服务状态出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取服务状态时发生未知错误'
    });
  }
});

// 获取缺失嵌入的记忆列表
router.get('/missing-embeddings', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    
    const query = `
      SELECT m.id, m.content, m.user_id, m.timestamp, m.type
      FROM memories m
      WHERE NOT EXISTS (
        SELECT 1 FROM memory_embeddings me 
        WHERE me.memory_id = m.id
      )
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    
    return res.json({
      success: true,
      count: result.rows.length,
      memories: result.rows
    });
    
  } catch (error: any) {
    console.error('获取缺失嵌入的记忆列表出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取缺失嵌入的记忆列表时发生未知错误'
    });
  }
});

// 记忆嵌入统计
router.get('/stats', async (req, res) => {
  try {
    // 获取总记忆数
    const totalMemoriesQuery = `
      SELECT COUNT(*) as count FROM memories
    `;
    
    // 获取已有嵌入的记忆数
    const withEmbeddingsQuery = `
      SELECT COUNT(*) as count FROM memory_embeddings
    `;
    
    // 获取不同维度的向量统计
    const dimensionsQuery = `
      SELECT 
        json_array_length(vector_data) as dimensions, 
        COUNT(*) as count 
      FROM memory_embeddings 
      GROUP BY dimensions
    `;
    
    const [totalResult, embeddingsResult, dimensionsResult] = await Promise.all([
      pool.query(totalMemoriesQuery),
      pool.query(withEmbeddingsQuery),
      pool.query(dimensionsQuery)
    ]);
    
    // 整理维度统计数据
    const dimensionsStats: Record<string, number> = {};
    dimensionsResult.rows.forEach(row => {
      dimensionsStats[row.dimensions] = Number(row.count);
    });
    
    const totalMemories = Number(totalResult.rows[0].count);
    const withEmbeddings = Number(embeddingsResult.rows[0].count);
    const missingEmbeddings = totalMemories - withEmbeddings;
    
    return res.json({
      success: true,
      stats: {
        totalMemories,
        withEmbeddings,
        missingEmbeddings,
        completionPercentage: Math.round((withEmbeddings / totalMemories) * 100 * 100) / 100,
        dimensions: dimensionsStats
      }
    });
    
  } catch (error: any) {
    console.error('获取嵌入统计信息出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取嵌入统计信息时发生未知错误'
    });
  }
});

// 向量维度统计
router.get('/dimensions', async (req, res) => {
  try {
    // 获取不同维度的向量统计
    const query = `
      SELECT 
        json_array_length(vector_data) as dimensions, 
        COUNT(*) as count 
      FROM memory_embeddings 
      GROUP BY dimensions 
      ORDER BY dimensions
    `;
    
    const result = await pool.query(query);
    
    // 整理维度统计数据
    const dimensionsStats: Record<string, number> = {};
    result.rows.forEach(row => {
      dimensionsStats[row.dimensions] = Number(row.count);
    });
    
    return res.json({
      success: true,
      dimensions: dimensionsStats
    });
    
  } catch (error: any) {
    console.error('获取向量维度统计出错:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取向量维度统计时发生未知错误'
    });
  }
});

export default router;
