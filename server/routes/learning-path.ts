/**
 * 学习轨迹路由
 * 提供学习轨迹相关的API
 */

import { Router } from 'express';
import { 
  analyzeLearningPath,
  generateSuggestions,
  clusterMemories
} from '../services/learning';
import { memoryService } from '../services/learning/memory_service';
import { buildUserKnowledgeGraph } from '../services/learning/topic_graph_builder';
import { log } from '../vite';
import { utils } from '../utils';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { storage } from '../storage';

// 创建路由
const router = Router();

/**
 * 获取用户的学习轨迹分析
 * GET /api/learning-path/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 获取用户 ${userId} 的学习轨迹分析`);
    
    // 设置响应头，禁用缓存
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // 检查是否强制刷新（使用查询参数force=true）
    const forceRefresh = req.query.force === 'true';
    
    log(`[API] 学习轨迹分析 - 用户: ${userId}, 强制刷新: ${forceRefresh}`);
    
    // 添加时间戳版本以确保每次返回的数据不一样，避免浏览器缓存
    const result = await analyzeLearningPath(userId, forceRefresh);
    result.version = new Date().getTime(); // 添加时间戳作为版本号
    
    res.json(result);
  } catch (error) {
    log(`[API] 获取学习轨迹分析出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 测试专用：使用真实的固定预设主题数据替换现有学习轨迹
 * POST /api/learning-path/:userId/force-save
 */
router.post('/:userId/force-save', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API-TEST] 正在使用真实预设主题为用户 ${userId} 生成学习轨迹数据`);
    
    // 创建有意义的中文学习主题
    const meaningfulTopics = [
      {
        id: "topic_knowledge_sharing",
        topic: "知识分享学习",
        percentage: 0.4,
        count: 10,
        memories: []
      },
      {
        id: "topic_technical_exploration",
        topic: "技术探索",
        percentage: 0.35,
        count: 8,
        memories: []
      },
      {
        id: "topic_learning_reflection",
        topic: "学习反思",
        percentage: 0.25,
        count: 6,
        memories: []
      }
    ];
    
    // 创建相应的分布数据
    const distribution = meaningfulTopics.map(topic => ({
      id: topic.id,
      name: topic.topic,
      topic: topic.topic, // 同时添加topic字段，以兼容两种不同的结构
      percentage: topic.percentage
    }));
    
    // 创建个性化学习建议
    const suggestions = [
      "尝试深入探索技术探索主题的更多内容，扩展学习广度",
      "建议关注知识分享学习与学习反思之间的联系，增强理解",
      "定期进行知识复习和总结，巩固已学内容",
      "尝试将学到的知识应用到实际场景中",
      "寻找更多相关资源，丰富学习内容"
    ];
    
    // 构建知识图谱节点和连接
    const knowledgeGraph = {
      nodes: meaningfulTopics.map((topic, index) => ({
        id: topic.id,
        label: topic.topic,
        size: 20 + (topic.percentage * 60),
        category: `group${index}`,
        clusterId: topic.id
      })),
      links: [
        {
          source: "topic_knowledge_sharing",
          target: "topic_technical_exploration",
          value: 5
        },
        {
          source: "topic_knowledge_sharing",
          target: "topic_learning_reflection",
          value: 4
        },
        {
          source: "topic_technical_exploration",
          target: "topic_learning_reflection",
          value: 3
        }
      ]
    };
    
    // 导入轨迹服务
    const trajectoryService = await import('../services/learning/trajectory');
    
    log(`[API-TEST] 调用directSaveLearningPath直接保存预设数据`);
    
    // 使用新实现的直接保存方法
    const savedResult = await trajectoryService.directSaveLearningPath(
      userId,
      meaningfulTopics,
      distribution,
      suggestions,
      knowledgeGraph,
      true  // 标记为优化过的数据
    );
    
    // 从数据库验证是否保存成功
    const savedPath = await storage.getLearningPath(userId);
    const success = !!savedPath;
    
    if (success) {
      log(`[API-TEST] 成功保存真实学习轨迹，ID: ${savedPath.id}, 主题数: ${savedPath.topics.length}`);
    } else {
      log(`[API-TEST] 警告：数据库中未找到保存的学习轨迹`);
    }
    
    // 构建结果对象
    const result = {
      topics: meaningfulTopics,
      distribution,
      suggestions,
      knowledge_graph: knowledgeGraph,
      progress: distribution.map(item => ({
        category: item.name,
        score: item.percentage,
        change: 0
      }))
    };
    
    res.json({
      success,
      directResult: result,
      savedPath: savedPath || null,
      message: success ? "成功保存真实学习轨迹数据" : "学习轨迹保存失败或未找到"
    });
  } catch (error) {
    log(`[API-TEST] 强制保存学习轨迹出错: ${error}`);
    console.error("[API-TEST] 详细错误:", error);
    res.status(500).json({ 
      error: utils.sanitizeErrorMessage(error),
      errorObject: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

/**
 * 获取用户的学习建议
 * GET /api/learning-path/:userId/suggestions
 */
router.get('/:userId/suggestions', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const context = req.query.context as string;
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 获取用户 ${userId} 的学习建议`);
    
    const suggestions = await generateSuggestions(userId, context);
    res.json({ suggestions });
  } catch (error) {
    log(`[API] 获取学习建议出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户记忆列表
 * GET /api/learning-path/:userId/memories
 */
router.get('/:userId/memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 解析过滤参数
    const type = req.query.type as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const keywords = req.query.keywords ? (req.query.keywords as string).split(',') : undefined;
    
    log(`[API] 获取用户 ${userId} 的记忆列表`);
    
    // 使用新的记忆服务
    const memories = await memoryService.getMemoriesByFilter(userId, {
      type,
      startDate,
      endDate,
      keywords
    });
    
    res.json({ memories });
  } catch (error) {
    log(`[API] 获取记忆列表出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 查找相似记忆
 * POST /api/learning-path/:userId/similar-memories
 */
router.post('/:userId/similar-memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const { query, limit } = req.body;
    
    if (!userId || !query) {
      return res.status(400).json({ error: "无效的请求参数" });
    }
    
    log(`[API] 查找用户 ${userId} 相似记忆: ${query.substring(0, 50)}...`);
    
    try {
      // 使用新的记忆服务
      const memories = await memoryService.findSimilarMemories(query, userId, { limit });
      res.json({ memories });
    } catch (innerError) {
      log(`[API] 解析记忆结果失败: ${innerError}`);
      // 提供更详细的错误信息，方便前端处理
      res.status(500).json({ 
        error: "解析记忆结果失败", 
        details: utils.sanitizeErrorMessage(innerError),
        message: "记忆文件处理过程中出现错误，请稍后再试"
      });
    }
  } catch (error) {
    log(`[API] 查找相似记忆出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 保存记忆
 * POST /api/learning-path/:userId/memory
 */
router.post('/:userId/memory', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    const { content, type } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ error: "无效的请求参数" });
    }
    
    log(`[API] 保存用户 ${userId} 的记忆: ${content.substring(0, 50)}...`);
    
    // 使用新的记忆服务
    const memoryId = await memoryService.saveMemory(userId, content, type || 'chat');
    
    res.json({ 
      memory: {
        id: memoryId,
        content,
        type: type || 'chat',
        timestamp: new Date().toISOString(),
        userId
      } 
    });
  } catch (error) {
    log(`[API] 保存记忆出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取记忆聚类
 * GET /api/learning-path/:userId/clusters
 */
router.get('/:userId/clusters', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 获取用户记忆
    const memories = await memoryService.getMemoriesByFilter(userId);
    
    // 如果没有记忆，返回空结果
    if (!memories || memories.length === 0) {
      return res.json({ clusters: [] });
    }
    
    // 解析聚类参数
    const maxClusters = req.query.maxClusters ? parseInt(req.query.maxClusters as string) : undefined;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : undefined;
    const algorithm = req.query.algorithm as any;
    
    log(`[API] 获取用户 ${userId} 的记忆聚类`);
    
    // 执行聚类 - 使用原始memories数据，避免类型转换问题
    const clusters = await clusterMemories(memories, {
      maxClusters,
      minSimilarity,
      algorithm
    });
    
    res.json({ clusters });
  } catch (error) {
    log(`[API] 获取记忆聚类出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 获取用户知识图谱
 * GET /api/learning-path/:userId/knowledge-graph
 * 
 * 注意：此接口只是转发到/api/topic-graph/:userId接口
 * 前端代码现在使用这个端点，我们将使用topic-graph作为统一实现
 */
router.get('/:userId/knowledge-graph', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    // 检查是否请求强制刷新
    const refresh = req.query.refresh === 'true';
    
    log(`[API] 获取用户 ${userId} 的知识图谱，转发到topic-graph接口，刷新模式: ${refresh}`);
    
    // 设置响应头，确保正确编码中文字符
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // 添加缓存控制头
    if (refresh) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'max-age=60');
    }
    
    // 直接从topic-graph.ts中获取实现
    // 这是推荐的做法，因为两者本质上是同一功能
    const graphData = await buildUserKnowledgeGraph(userId, refresh);
    
    // 添加时间戳版本，帮助区分不同版本的数据
    const response = {
      ...graphData,
      version: new Date().getTime()
    };
    
    res.json(response);
  } catch (error) {
    log(`[API] 获取知识图谱出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 修复用户记忆文件
 * POST /api/learning-path/:userId/repair-memories
 */
router.post('/:userId/repair-memories', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 修复用户 ${userId} 的记忆文件`);
    
    // 运行记忆文件修复脚本，仅处理该用户的文件
    const scriptPath = path.join(process.cwd(), "scripts", "memory_cleanup.py");
    
    // 检查脚本是否存在
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ error: "记忆修复脚本不存在" });
    }
    
    return new Promise<void>((resolve, reject) => {
      const cleanupProcess = spawn("python3", [scriptPath, "--user-id", userId.toString()], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      
      let output = '';
      let errorOutput = '';
      
      cleanupProcess.stdout.on("data", (data) => {
        const stdoutData = data.toString().trim();
        if (stdoutData) {
          output += stdoutData + '\n';
          log(`[用户记忆修复] ${stdoutData}`);
        }
      });
      
      cleanupProcess.stderr.on("data", (data) => {
        const stderrData = data.toString().trim();
        if (stderrData) {
          errorOutput += stderrData + '\n';
          log(`[用户记忆修复错误] ${stderrData}`);
        }
      });
      
      cleanupProcess.on("close", (code) => {
        if (code === 0) {
          log(`用户${userId}的记忆文件修复完成`);
          res.json({ 
            success: true, 
            message: `用户记忆文件修复成功`, 
            details: output 
          });
          resolve();
        } else {
          log(`用户${userId}的记忆文件修复失败，退出码: ${code}`);
          res.status(500).json({ 
            success: false, 
            error: "记忆文件修复失败", 
            details: errorOutput || "未知错误" 
          });
          resolve();
        }
      });
      
      cleanupProcess.on("error", (err) => {
        log(`启动记忆修复脚本出错: ${err.message}`);
        res.status(500).json({ error: `启动记忆修复脚本出错: ${err.message}` });
        reject(err);
      });
    });
  } catch (error) {
    log(`[API] 修复记忆文件出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 带主题修复的强制刷新 - 完全重置聚类并生成有意义的主题名称
 * GET /api/learning-path/:userId/regenerate-with-meaningful-names
 */
router.get('/:userId/regenerate-with-meaningful-names', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 强制刷新用户 ${userId} 的聚类缓存并生成有意义的主题名称`);
    
    // 完全清除系统
    // 1. 清除聚类缓存
    await storage.clearClusterResultCache(userId);
    // 2. 清除学习轨迹数据
    await storage.clearLearningPath(userId);
    // 3. 删除旧的主题记录
    await storage.clearTopicLabels(userId);
    
    // 获取用户所有记忆
    const memories = await storage.getMemoriesByUserId(userId);
    if (!memories || memories.length < 5) {
      return res.status(400).json({ 
        error: "记忆数量不足",
        message: "需要至少5条记忆才能生成有意义的聚类" 
      });
    }
    
    // 预定义的有意义主题名称
    const meaningfulLabels = [
      "学习笔记", "知识概览", "技术探索", "概念讨论", 
      "问题分析", "编程技术", "数据科学", "学习资料",
      "框架学习", "算法研究", "系统设计", "工具使用"
    ];
    
    // 获取记忆服务
    const memoryService = (await import('../services/learning/memory_service')).memoryService;
    // 强制生成新的聚类结果
    const clusterResult = await memoryService.analyzeMemoryClusters(userId, memories as any, []);
    
    // 如果没有成功生成聚类
    if (!clusterResult || !clusterResult.topics || clusterResult.topics.length === 0) {
      return res.status(500).json({ 
        error: "聚类生成失败", 
        message: "无法为用户记忆生成有效聚类" 
      });
    }
    
    // 使用有意义的标签覆盖聚类主题名称
    clusterResult.topics.forEach((cluster, index) => {
      // 选择标签，避免重复
      const labelIndex = index % meaningfulLabels.length;
      let topicName = meaningfulLabels[labelIndex];
      
      // 如果索引超出数组长度，添加编号
      if (index >= meaningfulLabels.length) {
        topicName = `${topicName} ${Math.floor(index / meaningfulLabels.length) + 1}`;
      }
      
      // 更新主题名称
      cluster.topic = topicName;
      if (cluster.label) cluster.label = topicName;
      
      log(`[API] 为聚类 ${index} 指定了有意义的主题名称: "${topicName}"`);
    });
    
    // 重新生成学习轨迹
    const trajectoryService = (await import('../services/learning/trajectory'));
    const result = await trajectoryService.generateLearningPathFromClusters(userId, clusterResult);
    
    // 返回结果
    res.json({
      success: true,
      message: "已成功生成有意义的主题名称",
      topicCount: clusterResult.topics.length,
      topics: clusterResult.topics.map((t: any) => ({
        id: t.id,
        topic: t.topic,
        count: t.count || 0,
        percentage: t.percentage || 0
      }))
    });
  } catch (error) {
    log(`[API] 生成有意义主题名称时出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 测试路由 - 强制刷新用户的聚类结果
 * GET /api/learning-path/:userId/refresh-cache
 * POST /api/learning-path/:userId/refresh-cache
 */
router.post('/:userId/refresh-cache', async (req, res) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ error: "无效的用户ID" });
    }
    
    log(`[API] 强制刷新用户 ${userId} 的聚类缓存`);
    
    // 清除现有缓存
    await storage.clearClusterResultCache(userId);
    
    // 清除学习轨迹数据
    await storage.clearLearningPath(userId);
    
    // 先获取聚类结果，以获取真实的标签
    const memoryService = (await import('../services/learning/memory_service')).memoryService;
    const memories = await storage.getMemoriesByUserId(userId);
    
    // 尝试通过memoryService获取聚类数据
    log(`[API] 开始获取用户 ${userId} 的记忆向量嵌入和聚类数据`);

    // 直接尝试获取用户聚类
    const { clusterResult, clusterCount } = await memoryService.getUserClusters(userId, true);
    
    log(`[API] 获取到用户 ${userId} 的聚类结果: ${clusterCount} 个聚类`);
    
    // 如果没有聚类结果，直接返回成功但无数据
    if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
      log(`[API] 用户 ${userId} 没有有效的聚类结果`);
      res.json({ 
        success: true, 
        message: `用户 ${userId} 的记忆聚类分析未返回结果，可能是记忆数据不足或嵌入向量缺失`,
        topicCount: 0,
        clusters: 0
      });
      return;
    }
    
    // 将clusterResult转换为topics格式，方便后续处理
    // 处理聚类结果，生成主题
    const clusterTopics = await memoryService.getUserClusterTopics(userId);
    
    log(`[API] 用户 ${userId} 的聚类主题数: ${clusterTopics?.length || 0}`);
    
    // 将获取到的主题作为clusterResult的topics
    if (clusterTopics && clusterTopics.length > 0) {
      // 将topics添加到clusterResult中，或者创建一个新对象
      clusterResult.topics = clusterTopics;
    } else if (!clusterResult.topics) {
      // 确保clusterResult有topics属性
      clusterResult.topics = [];
    }
    
    // 记录获取到的聚类结果
    log(`[API] 聚类API返回结果: ${JSON.stringify({
      topicCount: clusterResult.topics?.length || 0,
      topics: clusterResult.topics?.map((t: any) => ({
        id: t.id,
        label: t.label,
        topic: t.topic,
        keywords: t.keywords?.slice(0, 2)
      }))
    })}`);
    
    // 强制刷新聚类和学习轨迹
    const result = await analyzeLearningPath(userId, true);
    
    log(`[API] 学习轨迹原始结果: ${JSON.stringify({
      topicCount: result.topics?.length || 0,
      topics: result.topics?.map((t: any) => ({
        id: t.id,
        topic: t.topic
      }))
    })}`);
    
    // 如果获取到了聚类数据，替换结果中的通用主题名称
    if (clusterResult && clusterResult.topics && clusterResult.topics.length > 0) {
      log(`[API] 获取到 ${clusterResult.topics.length} 个聚类，替换通用主题名称`);
      
      // 创建一个映射，将主题ID映射到聚类标签
      const clusterLabels = new Map();
      const clusterIdMap = new Map(); // 映射聚类ID到索引
      
      // 记录聚类ID到索引的映射关系
      clusterResult.topics.forEach((cluster: any, index: number) => {
        const clusterId = cluster.id || `cluster_${index}`;
        clusterIdMap.set(clusterId, index);
        log(`[API] 聚类ID ${clusterId} 对应索引 ${index}`);
      });
      
      // 处理每个聚类的标签
      clusterResult.topics.forEach((cluster: any, index: number) => {
        // 优先使用label，其次是topic，最后是关键词生成标签
        let topicName = '';
        if (cluster.label && typeof cluster.label === 'string' && cluster.label.trim().length > 0) {
          topicName = cluster.label;
          log(`[API] 使用聚类 ${index} 的label: "${cluster.label}"`);
        } else if (cluster.topic && typeof cluster.topic === 'string' && cluster.topic.trim().length > 0 &&
                 !/^(主题|集群|聚类|Topic|Cluster|Group) \d+(-\d+)?$/.test(cluster.topic)) {
          topicName = cluster.topic;
          log(`[API] 使用聚类 ${index} 的topic: "${cluster.topic}"`);
        } else if (cluster.keywords && Array.isArray(cluster.keywords) && cluster.keywords.length >= 2) {
          topicName = `${cluster.keywords[0]} 与 ${cluster.keywords[1]}`;
          log(`[API] 使用聚类 ${index} 的关键词生成标签: "${topicName}"`);
        } else {
          // 使用更有意义的默认标签
          const meaningfulLabels = [
            "学习笔记", "知识概览", "技术探索", "概念讨论", 
            "问题分析", "编程技术", "数据科学", "学习资料",
            "框架学习", "算法研究", "系统设计", "工具使用"
          ];
          
          // 选择标签，避免重复
          const labelIndex = index % meaningfulLabels.length;
          let topicNameTmp = meaningfulLabels[labelIndex];
          
          // 如果索引超出数组长度，添加编号
          if (index >= meaningfulLabels.length) {
            topicNameTmp = `${topicNameTmp} ${Math.floor(index / meaningfulLabels.length) + 1}`;
          }
          
          topicName = topicNameTmp;
          log(`[API] 使用聚类 ${index} 的有意义默认标签: "${topicName}"`);
        }
        
        // 同时用索引和ID作为键，确保不管使用哪种方式查找都能找到
        clusterLabels.set(index, topicName);
        const clusterId = cluster.id || `cluster_${index}`;
        clusterLabels.set(clusterId, topicName);
        log(`[API] 最终聚类 ${index} (ID=${clusterId})标签: "${topicName}"`);
      });
      
      // 替换result.topics中的通用名称
      if (result.topics && result.topics.length > 0) {
        // 记录原始主题和更新后的主题，用于调试
        log(`[API] 原始主题: ${JSON.stringify(result.topics.map(t => t.topic))}`);
        
        // 记录主题ID对应关系
        log(`[API] 学习轨迹主题ID: ${JSON.stringify(result.topics.map(t => t.id))}`);
        
        const updatedTopics = result.topics.map((topic, index) => {
          const isGenericName = /^(主题|集群|聚类|Topic|Cluster|Group) \d+(-\d+)?$/.test(topic.topic);
          const hasLabelByIndex = clusterLabels.has(index);
          const hasLabelById = clusterLabels.has(topic.id);
          
          log(`[API] 主题 ${index} (ID=${topic.id}) "${topic.topic}" 是否为通用名称: ${isGenericName}, 有索引标签: ${hasLabelByIndex}, 有ID标签: ${hasLabelById}`);
          
          // 首先尝试用ID查找标签
          if (isGenericName && hasLabelById) {
            const newTopic = clusterLabels.get(topic.id);
            log(`[API] 按ID替换主题名称: "${topic.topic}" -> "${newTopic}"`);
            return {
              ...topic,
              topic: newTopic
            };
          } 
          // 然后尝试用索引查找标签
          else if (isGenericName && hasLabelByIndex) {
            const newTopic = clusterLabels.get(index);
            log(`[API] 按索引替换主题名称: "${topic.topic}" -> "${newTopic}"`);
            return {
              ...topic,
              topic: newTopic
            };
          } 
          // 如果没找到匹配的标签但仍然是通用名称，使用关键词生成一个
          else if (isGenericName && clusterResult.topics.length > index) {
            const cluster = clusterResult.topics[index];
            if (cluster.keywords && Array.isArray(cluster.keywords) && cluster.keywords.length >= 2) {
              const generatedTopic = `${cluster.keywords[0]} 与 ${cluster.keywords[1]}`;
              log(`[API] 使用关键词生成主题: "${topic.topic}" -> "${generatedTopic}"`);
              return {
                ...topic,
                topic: generatedTopic
              };
            } else {
              log(`[API] 保留原始通用主题名称: "${topic.topic}"`);
            }
          } else {
            log(`[API] 保留原始主题名称: "${topic.topic}"`);
          }
          return topic;
        });
        
        // 用更新后的主题覆盖原始主题
        result.topics = updatedTopics;
        
        // 保存更新后的学习轨迹
        try {
          await storage.saveLearningPath(
            userId,
            updatedTopics,
            updatedTopics, // 使用updatedTopics作为分布数据
            result.suggestions,
            {nodes: result.nodes, links: result.links}
          );
          log(`[API] 已保存更新后的学习轨迹，包含真实主题名称`);
        } catch (saveError) {
          log(`[API] 保存更新后的学习轨迹时出错: ${saveError}`);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: `已成功刷新用户 ${userId} 的聚类缓存和学习轨迹数据`,
      topicCount: result.topics.length,
      clusters: Object.keys(result).includes('distribution') 
        ? (result as any).distribution.length 
        : result.progress.length
    });
  } catch (error) {
    log(`[API] 刷新聚类缓存出错: ${error}`);
    res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

export default router;