/**
 * 知识图谱生成器
 * 基于记忆聚类结果构建知识图谱
 */

import { log } from "../../vite";
import { ClusterResult } from "./kmeans_clustering";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";

/**
 * 知识图谱节点接口
 */
export interface KnowledgeNode {
  id: string;           // 节点唯一标识
  label: string;        // 节点标签/名称
  size: number;         // 节点大小（代表重要性）
  category?: string;    // 节点类别（主题、概念、关键词等）
  clusterId?: string;   // 关联的聚类ID
}

/**
 * 知识图谱连接接口
 */
export interface KnowledgeLink {
  source: string;       // 源节点ID
  target: string;       // 目标节点ID
  value: number;        // 连接强度（0-1之间）
  type?: string;        // 连接类型
}

/**
 * 知识图谱接口
 */
export interface KnowledgeGraph {
  nodes: KnowledgeNode[];  // 图谱节点
  links: KnowledgeLink[];  // 图谱连接
}

/**
 * 基于聚类结果生成简化版知识图谱
 * 只包含聚类主题节点，不再包含单个记忆和关键词节点
 * @param clusterResult K-means聚类结果
 * @param memories 记忆数据
 * @param keywords 关键词数据 [记忆ID, 关键词数组]
 * @returns 知识图谱数据
 */
export async function generateKnowledgeGraph(
  clusterResult: ClusterResult,
  memories: Memory[],
  keywords: [string, string[]][]
): Promise<KnowledgeGraph> {
  // 节点和连接存储
  const nodes: KnowledgeNode[] = [];
  const links: KnowledgeLink[] = [];
  
  // 关键词映射
  const keywordMap = new Map<string | number, string[]>();
  keywords.forEach(([memoryId, wordList]) => {
    keywordMap.set(memoryId, wordList);
  });

  try {
    // 步骤1: 只为每个聚类创建主题节点
    clusterResult.centroids.forEach(centroid => {
      const clusterPoints = centroid.points;
      if (clusterPoints.length === 0) return;
      
      // 获取该聚类中所有记忆的关键词
      const allKeywords: string[] = [];
      clusterPoints.forEach(point => {
        const keywords = keywordMap.get(point.id) || [];
        allKeywords.push(...keywords);
      });
      
      // 计算关键词频率
      const keywordFrequency = new Map<string, number>();
      allKeywords.forEach(keyword => {
        if (keyword && keyword.trim()) { // 只添加有效关键词
          keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
        }
      });
      
      // 找出频率最高的关键词作为主题标签，只取一个词
      const topKeyword = Array.from(keywordFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 1); // 只选取最高频的一个关键词
      
      // 如果没有关键词，使用默认标签
      let mainKeyword = topKeyword.length > 0 
        ? topKeyword[0][0]  // 只使用单一关键词
        : `主题${centroid.id + 1}`;
      
      // 限制标签长度，防止显示问题，允许更长的标签（最多20字符）
      if (mainKeyword.length > 20) {
        mainKeyword = mainKeyword.substring(0, 20);
      }
      
      // 创建聚类主题节点（大尺寸）
      const clusterNodeId = `cluster_${centroid.id}`;
      nodes.push({
        id: clusterNodeId,
        label: mainKeyword,
        size: 20 + clusterPoints.length * 2, // 更大的主题节点
        category: 'cluster',
        clusterId: `${centroid.id}`
      });
    });
    
    // 步骤2: 直接计算聚类间的连接，基于共享关键词
    const clusterKeywords = new Map<number, Set<string>>();
    
    // 收集每个聚类的所有关键词
    clusterResult.centroids.forEach(centroid => {
      const keywordSet = new Set<string>();
      
      centroid.points.forEach(point => {
        const keywords = keywordMap.get(point.id) || [];
        keywords.forEach(kw => keywordSet.add(kw));
      });
      
      clusterKeywords.set(centroid.id, keywordSet);
    });
    
    // 计算聚类之间的关键词重叠度，添加连接
    const clusterIds = Array.from(clusterKeywords.keys());
    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const clusterId1 = clusterIds[i];
        const clusterId2 = clusterIds[j];
        
        const keywords1 = clusterKeywords.get(clusterId1) || new Set();
        const keywords2 = clusterKeywords.get(clusterId2) || new Set();
        
        // 计算共同关键词数量
        let commonKeywordsCount = 0;
        const keywords1Array = Array.from(keywords1);
        
        for (const kw of keywords1Array) {
          if (keywords2.has(kw)) {
            commonKeywordsCount++;
          }
        }
        
        // 使用较低的阈值，确保图谱连通性
        if (commonKeywordsCount > 0) {
          const similarity = commonKeywordsCount / Math.min(keywords1.size, keywords2.size);
          
          links.push({
            source: `cluster_${clusterId1}`,
            target: `cluster_${clusterId2}`,
            value: similarity,
            type: 'related'
          });
        }
      }
    }
    
    // 如果连接太少，添加额外连接确保图谱连通性
    if (nodes.length > 1 && links.length < nodes.length - 1) {
      // 至少需要n-1个连接才能保证所有节点连通
      for (let i = 0; i < nodes.length - 1; i++) {
        const existingLink = links.find(
          link => (link.source === nodes[i].id && link.target === nodes[i+1].id) ||
                 (link.source === nodes[i+1].id && link.target === nodes[i].id)
        );
        
        if (!existingLink) {
          links.push({
            source: nodes[i].id,
            target: nodes[i+1].id,
            value: 0.1, // 低相似度
            type: 'proximity'
          });
        }
      }
    }
    
    log(`简化知识图谱生成完成，包含${nodes.length}个主题节点和${links.length}个连接`);
    return { nodes, links };
    
  } catch (error) {
    log(`知识图谱生成错误: ${error}`);
    
    // 返回空图谱，不使用默认节点
    return {
      nodes: [],
      links: []
    };
  }
}

/**
 * 基于用户ID生成知识图谱
 * @param userId 用户ID
 * @returns 知识图谱
 */
export async function generateUserKnowledgeGraph(userId: number): Promise<KnowledgeGraph> {
  try {
    // 获取用户记忆
    const memories = await storage.getMemoriesByUserId(userId);
    
    if (!memories || memories.length === 0) {
      log(`用户${userId}没有记忆数据，返回空知识图谱`);
      // 返回空图谱，不使用默认节点
      return {
        nodes: [],
        links: []
      };
    }
    
    log(`为用户${userId}生成知识图谱，共${memories.length}条记忆`);
    
    // 过滤和分类记忆ID (数字ID和时间戳ID分开处理)
    const isNumericId = (id: string | number): boolean => {
      const idStr = String(id);
      return /^\d+$/.test(idStr) && idStr.length < 15; // 纯数字且长度小于15视为传统数字ID
    };
    
    const isTimestampId = (id: string | number): boolean => {
      const idStr = String(id);
      return /^\d{17,}$/.test(idStr); // 17位以上数字视为时间戳ID
    };
    
    // 按ID类型分组记忆
    const numericIdMemories = memories.filter(m => isNumericId(m.id));
    const timestampIdMemories = memories.filter(m => isTimestampId(m.id));
    const otherIdMemories = memories.filter(m => !isNumericId(m.id) && !isTimestampId(m.id));
    
    log(`记忆ID类型分析: 数字ID=${numericIdMemories.length}, 时间戳ID=${timestampIdMemories.length}, 其他=${otherIdMemories.length}`);
    
    // 获取记忆的向量嵌入
    const memoryVectors: { id: string | number; vector: number[] }[] = [];
    
    // 处理所有类型的记忆
    const allProcessedMemories = [...numericIdMemories, ...timestampIdMemories, ...otherIdMemories];
    
    for (const memory of allProcessedMemories) {
      try {
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        
        if (embedding && embedding.vectorData && Array.isArray(embedding.vectorData)) {
          memoryVectors.push({
            id: memory.id,
            vector: embedding.vectorData
          });
        }
      } catch (error) {
        log(`获取记忆${memory.id}的向量嵌入时出错: ${error}`);
      }
    }
    
    if (memoryVectors.length === 0) {
      log('没有找到有效的向量嵌入，返回空知识图谱');
      // 返回空图谱，不使用默认节点
      return {
        nodes: [],
        links: []
      };
    }
    
    log(`找到${memoryVectors.length}条带有有效向量嵌入的记忆`);
    
    // 获取记忆关键词
    const memoryKeywords: [string, string[]][] = [];
    
    for (const memory of allProcessedMemories) {
      try {
        const keywords = await storage.getKeywordsByMemoryId(memory.id);
        
        if (keywords && keywords.length > 0) {
          memoryKeywords.push([
            `${memory.id}`, 
            keywords.map(k => k.keyword)
          ]);
        }
      } catch (error) {
        log(`获取记忆${memory.id}的关键词时出错: ${error}`);
      }
    }
    
    log(`找到${memoryKeywords.length}条带有关键词的记忆`);
    
    // 如果找不到足够的记忆数据，尝试创建一些测试记忆
    if (memoryVectors.length < 5 && userId === 6) {
      log('由于向量数据不足，尝试创建一些测试记忆');
      
      try {
        // 尝试创建一个测试记忆作为示例
        const testMemory = await storage.createMemory(
          userId, 
          "这是一个自动创建的测试记忆，用于生成知识图谱示例", 
          "test",
          "知识图谱测试数据"
        );
        
        // 添加关键词
        await storage.addKeywordToMemory(testMemory.id, "知识图谱");
        await storage.addKeywordToMemory(testMemory.id, "测试");
        await storage.addKeywordToMemory(testMemory.id, "示例");
        
        // 创建向量嵌入
        const vector = Array.from({length: 10}, () => Math.random() * 2 - 1);
        await storage.saveMemoryEmbedding(testMemory.id, vector);
        
        // 添加到处理结果中
        memoryVectors.push({
          id: testMemory.id,
          vector
        });
        
        memoryKeywords.push([
          `${testMemory.id}`,
          ["知识图谱", "测试", "示例"]
        ]);
        
        log(`成功创建测试记忆数据，ID=${testMemory.id}`);
      } catch (error) {
        log(`创建测试记忆数据时出错: ${error}`);
      }
    }
    
    // 导入K-means聚类算法
    const { simpleClustering } = await import('./kmeans_clustering');
    
    try {
      // 检查向量维度，并选择拥有最多向量的维度
      const dimensionCounts = new Map<number, number>();
      
      // 统计每个维度的向量数量
      memoryVectors.forEach(memoryVec => {
        const dimension = memoryVec.vector.length;
        dimensionCounts.set(dimension, (dimensionCounts.get(dimension) || 0) + 1);
      });
      
      // 维度选择逻辑：优先考虑3072维向量，其次是768维
      // 如果这些高质量向量不足5个，才考虑数量最多的向量维度
      const highQualityDimensions = [3072, 768];
      let optimalDimension = -1;
      let maxCount = 0;
      
      // 首先检查高质量维度
      for (const dimension of highQualityDimensions) {
        const count = dimensionCounts.get(dimension) || 0;
        log(`[知识图谱] 高质量维度=${dimension}的向量数量: ${count}`);
        if (count >= 5) {
          optimalDimension = dimension;
          maxCount = count;
          log(`[知识图谱] 选择高质量维度=${dimension}，拥有${count}个向量`);
          break;
        }
      }
      
      // 如果没有足够的高质量维度向量，退回到选择数量最多的维度
      if (optimalDimension === -1) {
        dimensionCounts.forEach((count, dimension) => {
          log(`[知识图谱] 维度=${dimension}的向量数量: ${count}`);
          if (count > maxCount) {
            maxCount = count;
            optimalDimension = dimension;
          }
        });
        log(`[知识图谱] 未找到足够的高质量维度向量，退回到数量最多的维度=${optimalDimension}`);
      }
      
      log(`[知识图谱] 选择最优维度=${optimalDimension}，拥有${maxCount}个向量`);
      
      // 只保留维度匹配的向量
      const filteredMemoryVectors = memoryVectors.filter(memoryVec => 
        memoryVec.vector.length === optimalDimension
      );
      
      if (filteredMemoryVectors.length < 5) {
        log(`[知识图谱] 用户${userId}的有效向量数据不足5条（只有${filteredMemoryVectors.length}条），返回空知识图谱`);
        // 返回空图谱，不使用默认节点
        return {
          nodes: [],
          links: []
        };
      }
      
      log(`为用户${userId}执行聚类，使用${filteredMemoryVectors.length}条有效记忆向量，维度=${optimalDimension}`);
      
      // 执行聚类
      const clusterResult = simpleClustering(filteredMemoryVectors);
      
      // 基于聚类结果生成知识图谱
      return generateKnowledgeGraph(clusterResult, memories, memoryKeywords);
    } catch (clusterError) {
      log(`聚类过程出错: ${clusterError}`);
      
      // 创建简单的知识图谱，不依赖聚类
      const fallbackNodes: KnowledgeNode[] = [];
      const fallbackLinks: KnowledgeLink[] = [];
      
      // 提取所有关键词，创建简单图谱
      const allKeywords = new Set<string>();
      const keywordMap = new Map<string, string[]>(); // memoryId -> keywords
      
      memoryKeywords.forEach(([memoryId, keywords]) => {
        keywordMap.set(memoryId, keywords);
        keywords.forEach(kw => allKeywords.add(kw));
      });
      
      // 创建关键词节点
      const keywordNodes = Array.from(allKeywords).slice(0, 10).map((keyword, index) => ({
        id: `keyword_${index}`,
        label: keyword,
        size: 5,
        category: 'keyword'
      }));
      
      fallbackNodes.push(...keywordNodes);
      
      // 创建记忆节点（最多5个）
      const memoryNodes = memories.slice(0, 5).map(memory => ({
        id: `memory_${memory.id}`,
        label: memory.summary?.substring(0, 20) + '...' || '记忆片段',
        size: 3,
        category: 'memory'
      }));
      
      fallbackNodes.push(...memoryNodes);
      
      // 创建记忆与关键词的连接
      memoryNodes.forEach(memoryNode => {
        const memoryId = memoryNode.id.replace('memory_', '');
        const keywords = keywordMap.get(memoryId) || [];
        
        keywords.forEach(keyword => {
          const keywordNode = keywordNodes.find(n => n.label === keyword);
          if (keywordNode) {
            fallbackLinks.push({
              source: memoryNode.id,
              target: keywordNode.id,
              value: 0.5
            });
          }
        });
      });
      
      // 创建关键词之间的连接
      for (let i = 0; i < keywordNodes.length; i++) {
        for (let j = i + 1; j < keywordNodes.length; j++) {
          // 只连接有共同记忆的关键词
          let hasCommonMemory = false;
          memoryKeywords.forEach(([, keywords]) => {
            if (keywords.includes(keywordNodes[i].label) && 
                keywords.includes(keywordNodes[j].label)) {
              hasCommonMemory = true;
            }
          });
          
          if (hasCommonMemory) {
            fallbackLinks.push({
              source: keywordNodes[i].id,
              target: keywordNodes[j].id,
              value: 0.3
            });
          }
        }
      }
      
      log(`创建了备用知识图谱，包含${fallbackNodes.length}个节点和${fallbackLinks.length}个连接`);
      return { nodes: fallbackNodes, links: fallbackLinks };
    }
    
  } catch (error) {
    log(`生成用户知识图谱时出错: ${error}`);
    // 返回空图谱，不使用默认节点
    return {
      nodes: [],
      links: []
    };
  }
}

export default {
  generateKnowledgeGraph,
  generateUserKnowledgeGraph
};