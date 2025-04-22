/**
 * 记忆修复路由
 * 提供用于修复和增强记忆数据的API端点
 */
import express from 'express';
import { log } from '../vite';
import { memoryService } from '../services/learning/memory_service';

const router = express.Router();

/**
 * 修复用户记忆数据
 * GET /api/repair-memory?userId=<userId>
 * 处理用户的记忆数据，添加缺失的摘要、关键词和向量嵌入
 */
router.get('/', async (req, res) => {
  try {
    // 获取用户ID
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : (req.session?.userId || 0);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '未指定有效的用户ID'
      });
    }

    log(`[API] 开始修复用户ID=${userId}的记忆数据`);
    
    // 执行记忆修复
    const repairedCount = await memoryService.repairUserMemories(userId);
    
    return res.json({
      success: true,
      repairedCount,
      message: `成功修复 ${repairedCount} 条记忆数据`
    });
  } catch (error) {
    log(`[API] 修复记忆数据时出错: ${error}`, "error");
    
    return res.status(500).json({
      success: false,
      message: `修复记忆数据时出错: ${error}`
    });
  }
});

export default router;