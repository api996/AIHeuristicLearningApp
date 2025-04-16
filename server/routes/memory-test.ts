/**
 * 测试用记忆空间路由
 */
import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { utils } from '../utils';

// 创建路由器
const router = Router();

// 获取用户的所有记忆
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // 从数据库获取记忆数据
    const memories = await storage.getMemoriesByUserId(userId);
    
    // 将数据库记忆对象转换为前端格式
    const formattedMemories = await Promise.all(
      memories.map(async (memory) => {
        // 获取记忆的关键词
        const keywordObjects = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordObjects.map(k => k.keyword);
        
        return {
          id: memory.id.toString(),
          content: memory.content || '',
          type: memory.type || 'text',
          timestamp: memory.createdAt?.toISOString() || new Date().toISOString(),
          summary: memory.summary || '',
          keywords: keywords
        };
      })
    );
    
    return res.json({ memories: formattedMemories });
  } catch (error) {
    console.error(`[测试路由] 获取记忆时出错:`, error);
    return res.status(500).json({ error: String(error) });
  }
});

// 检查记忆数据
router.get('/:userId/check', async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // 从数据库获取记忆数据
    const memories = await storage.getMemoriesByUserId(userId);
    
    // 获取关键词数据
    let keywordCount = 0;
    for (const memory of memories) {
      const keywords = await storage.getKeywordsByMemoryId(memory.id);
      keywordCount += keywords.length;
    }
    
    return res.json({ 
      userId,
      memoryCount: memories.length,
      keywordCount,
      status: 'success'
    });
  } catch (error) {
    console.error(`[测试路由] 检查记忆时出错:`, error);
    return res.status(500).json({ error: String(error) });
  }
});

export default router;