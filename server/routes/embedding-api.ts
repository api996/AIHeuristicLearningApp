/**
 * 嵌入向量 API路由
 * 提供快速生成嵌入向量的HTTP端点
 */

import { Router } from 'express';
import { genAiService } from '../services/genai/genai_service';
import { Pool } from '@neondatabase/serverless'; 

const router = Router();

// 获取数据库连接
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// GenAI服务已经在应用启动时初始化
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
    
    // 使用GenAI服务生成嵌入
    const embedding = await genAiService.generateEmbedding(text);
    
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
    
    // 查询记忆内容
    const memoryQuery = await pool.query(
      'SELECT content FROM memories WHERE id = $1',
      [memoryId]
    );
    
    if (memoryQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `未找到ID为 ${memoryId} 的记忆`
      });
    }
    
    const content = memoryQuery.rows[0].content;
    
    // 检查该记忆是否已有嵌入
    const existingQuery = await pool.query(
      'SELECT 1 FROM memory_embeddings WHERE memory_id = $1',
      [memoryId]
    );
    
    if (existingQuery.rows.length > 0) {
      // 删除现有嵌入
      await pool.query(
        'DELETE FROM memory_embeddings WHERE memory_id = $1',
        [memoryId]
      );
      console.log(`删除记忆 ${memoryId} 的现有嵌入`);
    }
    
    // 生成新的嵌入向量
    const embedding = await genAiService.generateEmbedding(content);
    
    if (!embedding || embedding.length !== 3072) {
      return res.status(500).json({
        success: false,
        error: `嵌入生成失败或维度不正确 (实际维度: ${embedding ? embedding.length : 0}, 期望: 3072)`
      });
    }
    
    // 保存嵌入向量
    await pool.query(
      'INSERT INTO memory_embeddings (memory_id, vector_data) VALUES ($1, $2)',
      [memoryId, JSON.stringify(embedding)]
    );
    
    console.log(`成功为记忆 ${memoryId} 生成并保存 ${embedding.length} 维嵌入向量`);
    
    return res.json({
      success: true,
      memoryId,
      dimensions: embedding.length,
      message: `成功为记忆生成并保存 ${embedding.length} 维嵌入向量`
    });
    
  } catch (error: any) {
    console.error('处理记忆嵌入错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理记忆嵌入时发生未知错误'
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
