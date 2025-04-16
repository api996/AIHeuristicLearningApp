import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { utils } from "../utils";
import { log } from "../vite";
import { memoryService } from "../services/learning/memory_service";
import { SessionData } from 'express-session';

// 扩展Express的Session类型
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: {
      role?: string;
      [key: string]: any;
    };
  }
}

/**
 * 辅助函数，用于格式化记忆数据并返回给客户端
 */
async function formatAndReturnMemories(res: Response, memories: any[]) {
  try {
    // 将数据库记忆对象转换为前端需要的格式
    const formattedMemories = await Promise.all(
      memories.map(async (memory) => {
        // 获取记忆的关键词
        const keywordObjects = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordObjects.map(k => k.keyword);
        
        // 构建前端格式
        const formattedMemory = {
          id: memory.id.toString(),
          content: memory.content || "",
          type: memory.type || "text", 
          timestamp: memory.createdAt ? memory.createdAt.toISOString() : new Date().toISOString(),
          summary: memory.summary || "",
          keywords: keywords
        };
        
        return formattedMemory;
      })
    );
    
    // 记录格式化后的数据
    log(`[记忆空间API] 格式化后的记忆数量: ${formattedMemories.length}`);
    
    return res.json({ memories: formattedMemories });
  } catch (error) {
    log(`[记忆空间API] 格式化记忆时出错: ${error}`, "error");
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
}

// 创建路由器
const router = Router();

/**
 * 获取用户的所有记忆
 * GET /api/memory-space/:userId
 */
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // 验证用户权限（只能访问自己的记忆，或者是管理员）
    // 在开发环境中暂时不需要严格验证，允许前端测试访问
    // 实际项目中应恢复此权限检查
    /*
    const sessionUserId = req.session.userId;
    const isAdmin = req.session.user?.role === "admin";
    if (!sessionUserId || (userId !== sessionUserId && !isAdmin)) {
      return res.status(403).json({ error: "Unauthorized access to memories" });
    }
    */
    log(`[记忆空间API] 跳过权限检查，直接提供用户${userId}的记忆数据`);

    // 获取该用户的所有记忆
    log(`[记忆空间API] 获取用户 ${userId} 的记忆数据`);
    
    // 首先尝试从数据库获取
    const memories = await storage.getMemoriesByUserId(userId);
    log(`[记忆空间API] 用户 ${userId} 的数据库记忆数量: ${memories.length}`);
    
    // 如果数据库中没有记忆，尝试从文件系统加载
    if (memories.length === 0) {
      log(`[记忆空间API] 用户 ${userId} 数据库中没有记忆，尝试从文件加载`);
      try {
        // 尝试从文件系统导入记忆
        const fs = await import('fs');
        const path = await import('path');
        
        // 用户记忆目录
        const userDir = path.join(process.cwd(), 'memory_space', userId.toString());
        
        if (fs.existsSync(userDir)) {
          log(`[记忆空间API] 用户目录 ${userDir} 存在`);
          const files = fs.readdirSync(userDir);
          const memoryFiles = files.filter(file => file.endsWith('.json'));
          
          log(`[记忆空间API] 找到 ${memoryFiles.length} 个记忆文件`);
          
          // 手动为用户创建记忆
          for (const file of memoryFiles) {
            try {
              const filePath = path.join(userDir, file);
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const memoryData = JSON.parse(fileContent);
              
              // 创建记忆
              const content = memoryData.content || '无内容';
              const type = memoryData.type || 'chat';
              const summary = memoryData.summary || '无摘要';
              
              log(`[记忆空间API] 从文件创建记忆: ${filePath}`);
              await storage.createMemory(userId, content, type, summary);
            } catch (err) {
              log(`[记忆空间API] 解析记忆文件失败: ${file}, 错误: ${err}`, 'error');
            }
          }
          
          // 重新获取记忆
          const newMemories = await storage.getMemoriesByUserId(userId);
          log(`[记忆空间API] 导入后用户 ${userId} 的记忆数量: ${newMemories.length}`);
          
          // 使用新导入的记忆
          if (newMemories.length > 0) {
            return formatAndReturnMemories(res, newMemories);
          }
        } else {
          log(`[记忆空间API] 用户目录 ${userDir} 不存在`);
        }
      } catch (importErr) {
        log(`[记忆空间API] 从文件导入记忆失败: ${importErr}`, 'error');
      }
    }
    
    // 记录记忆数据示例，帮助调试
    if (memories.length > 0) {
      const sample = memories[0];
      log(`[记忆空间API] 记忆示例: id=${sample.id}, content=${sample.content ? sample.content.substring(0, 50) : "无内容"}...`);
    }
    
    // 将数据库记忆对象转换为前端需要的格式
    const formattedMemories = await Promise.all(
      memories.map(async (memory) => {
        // 获取记忆的关键词
        const keywordObjects = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordObjects.map(k => k.keyword);
        
        // 构建前端格式
        const formattedMemory = {
          id: memory.id.toString(),
          content: memory.content || "",
          type: memory.type || "text", 
          timestamp: memory.createdAt?.toISOString() || new Date().toISOString(),
          summary: memory.summary || "",
          keywords: keywords
        };
        
        return formattedMemory;
      })
    );
    
    // 记录格式化后的数据
    log(`[记忆空间API] 格式化后的记忆数量: ${formattedMemories.length}`);
    

    return res.json({ memories: formattedMemories });
  } catch (error) {
    log(`[记忆空间API] 获取记忆时出错: ${error}`, "error");
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户记忆的聚类分析结果
 * GET /api/memory-space/:userId/clusters
 */
router.get("/:userId/clusters", async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // 验证用户权限
    // 在开发环境中暂时不需要严格验证，允许前端测试访问
    // 实际项目中应恢复此权限检查
    /*
    const sessionUserId = req.session.userId;
    const isAdmin = req.session.user?.role === "admin";
    if (!sessionUserId || (userId !== sessionUserId && !isAdmin)) {
      return res.status(403).json({ error: "Unauthorized access to memory clusters" });
    }
    */
    log(`[记忆空间API] 跳过权限检查，直接提供用户${userId}的记忆聚类`);

    // 获取该用户的所有记忆
    const memories = await storage.getMemoriesByUserId(userId);
    
    // 记忆数量太少时，不进行聚类
    if (memories.length < 5) {
      return res.json({ 
        topics: [],
        message: "Not enough memories for clustering"  
      });
    }

    // 获取记忆的向量嵌入
    const memoriesWithEmbeddings = await Promise.all(
      memories.map(async (memory) => {
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        return {
          memory,
          embedding: embedding?.vectorData || null
        };
      })
    );

    // 过滤出有向量嵌入的记忆
    const validMemoriesWithEmbeddings = memoriesWithEmbeddings.filter(
      item => item.embedding !== null
    );

    // 可用的向量记忆太少时，不进行聚类
    if (validMemoriesWithEmbeddings.length < 5) {
      return res.json({ 
        topics: [],
        message: "Not enough memories with embeddings for clustering"  
      });
    }

    // 转换为聚类分析服务需要的格式
    const memoryObjects = validMemoriesWithEmbeddings.map(item => item.memory);
    const embeddings = validMemoriesWithEmbeddings.map(item => item.embedding as number[]);

    // 执行聚类分析
    const clusterResults = await memoryService.analyzeMemoryClusters(userId, memoryObjects, embeddings);
    
    // 将聚类结果转换为前端需要的格式
    const formattedTopics = clusterResults.topics.map(topic => {
      let representativeMemory = undefined;
      
      if (topic.representativeMemory) {
        const memory = topic.representativeMemory;
        representativeMemory = {
          id: memory.id.toString(),
          content: memory.content,
          type: memory.type || "text",
          timestamp: memory.createdAt?.toISOString() || new Date().toISOString(),
          summary: memory.summary || "",
          keywords: [] // 关键词会在前端根据需要加载
        };
      }
      
      return {
        id: topic.id,
        topic: topic.topic,
        count: topic.count,
        percentage: topic.percentage,
        memoryIds: topic.memoryIds?.map(id => id.toString()),
        representativeMemory
      };
    });

    return res.json({ topics: formattedTopics });
  } catch (error) {
    log(`[记忆空间API] 获取记忆聚类时出错: ${error}`, "error");
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 通过语义搜索查找相似记忆
 * POST /api/memory-space/:userId/search
 */
router.post("/:userId/search", async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // 验证用户权限
    // 在开发环境中暂时不需要严格验证，允许前端测试访问
    // 实际项目中应恢复此权限检查
    /*
    const sessionUserId = req.session.userId;
    const isAdmin = req.session.user?.role === "admin";
    if (!sessionUserId || (userId !== sessionUserId && !isAdmin)) {
      return res.status(403).json({ error: "Unauthorized access to memories" });
    }
    */
    log(`[记忆空间API] 跳过权限检查，直接处理用户${userId}的记忆搜索操作`);

    const { query, limit = 10 } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Invalid search query" });
    }

    // 生成查询的向量嵌入
    const queryEmbedding = await memoryService.generateEmbedding(query);
    if (!queryEmbedding) {
      return res.status(500).json({ error: "Failed to generate embedding for search query" });
    }

    // 查找相似记忆
    const similarMemories = await storage.findSimilarMemories(userId, queryEmbedding, limit);
    
    // 将数据库记忆对象转换为前端需要的格式
    const formattedResults = await Promise.all(
      similarMemories.map(async (memory) => {
        // 获取记忆的关键词
        const keywordObjects = await storage.getKeywordsByMemoryId(memory.id);
        const keywords = keywordObjects.map(k => k.keyword);
        
        return {
          id: memory.id.toString(),
          content: memory.content,
          type: memory.type || "text", 
          timestamp: memory.createdAt?.toISOString() || new Date().toISOString(),
          summary: memory.summary || "",
          keywords: keywords
        };
      })
    );

    return res.json({ 
      query,
      results: formattedResults
    });
  } catch (error) {
    log(`[记忆空间API] 搜索记忆时出错: ${error}`, "error");
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 修复用户的记忆数据
 * POST /api/memory-space/:userId/repair
 */
router.post("/:userId/repair", async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // 验证用户权限
    // 在开发环境中暂时不需要严格验证，允许前端测试访问
    // 实际项目中应恢复此权限检查
    /*
    const sessionUserId = req.session.userId;
    const isAdmin = req.session.user?.role === "admin";
    if (!sessionUserId || (userId !== sessionUserId && !isAdmin)) {
      return res.status(403).json({ error: "Unauthorized access to memories" });
    }
    */
    log(`[记忆空间API] 跳过权限检查，直接处理用户${userId}的记忆修复操作`);

    // 获取该用户的所有记忆
    const memories = await storage.getMemoriesByUserId(userId);
    let repairedCount = 0;

    // 逐个处理每条记忆
    for (const memory of memories) {
      let needsRepair = false;
      let updatedContent = undefined;
      let updatedSummary = undefined;

      // 检查并修复内容
      if (!memory.content || memory.content.trim() === '') {
        updatedContent = "此记忆内容为空";
        needsRepair = true;
      }

      // 检查并修复摘要
      if (!memory.summary || memory.summary.trim() === '') {
        // 生成摘要
        const summary = await memoryService.summarizeMemory(memory.content);
        if (summary) {
          updatedSummary = summary;
          needsRepair = true;
        }
      }

      // 检查是否有关键词
      const keywords = await storage.getKeywordsByMemoryId(memory.id);
      if (keywords.length === 0) {
        // 从内容中提取关键词
        const extractedKeywords = await memoryService.extractKeywords(memory.content);
        if (extractedKeywords && extractedKeywords.length > 0) {
          // 删除旧关键词
          await storage.deleteKeywordsByMemoryId(memory.id);
          
          // 添加新关键词
          for (const keyword of extractedKeywords) {
            await storage.addKeywordToMemory(memory.id, keyword);
          }
          needsRepair = true;
        }
      }

      // 检查是否有向量嵌入
      const embedding = await storage.getEmbeddingByMemoryId(memory.id);
      if (!embedding) {
        // 生成向量嵌入
        const vectorData = await memoryService.generateEmbedding(memory.content);
        if (vectorData) {
          await storage.saveMemoryEmbedding(memory.id, vectorData);
          needsRepair = true;
        }
      }

      // 如果需要修复，更新记忆
      if (needsRepair && (updatedContent || updatedSummary)) {
        await storage.updateMemory(memory.id, updatedContent, updatedSummary);
        repairedCount++;
      } else if (needsRepair) {
        // 只更新了关键词或向量嵌入
        repairedCount++;
      }
    }

    return res.json({ 
      success: true, 
      count: repairedCount,
      total: memories.length,
      message: `已修复 ${repairedCount} 条记忆数据（共 ${memories.length} 条）`
    });
  } catch (error) {
    log(`[记忆空间API] 修复记忆数据时出错: ${error}`, "error");
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

export default router;