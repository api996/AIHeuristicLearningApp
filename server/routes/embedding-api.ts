/**
 * 嵌入向量 API路由
 * 提供快速生成嵌入向量的HTTP端点
 */

import { Router } from 'express';
import { initializeGenAIService, genAiService } from '../services/genai/genai_service';

const router = Router();

// 初始化GenAI服务
initializeGenAIService().then(() => {
  console.log('向量嵌入API服务已初始化');
}).catch(err => {
  console.error('向量嵌入API服务初始化失败:', err);
});

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
    
  } catch (error) {
    console.error('嵌入API错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成嵌入时发生未知错误'
    });
  }
});

export default router;
