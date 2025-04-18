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
 * 基于聚类结果生成知识图谱
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
  
  // 记忆ID与数组索引的映射
  const memoryMap = new Map<string | number, number>();
  memories.forEach((memory, index) => {
    memoryMap.set(memory.id, index);
  });
  
  // 关键词映射
  const keywordMap = new Map<string | number, string[]>();
  keywords.forEach(([memoryId, wordList]) => {
    keywordMap.set(memoryId, wordList);
  });

  try {
    // 步骤1: 为每个聚类创建主题节点
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
        keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
      });
      
      // 找出频率最高的关键词作为主题标签
      let topKeywords: [string, number][] = Array.from(keywordFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      // 如果没有关键词，使用默认标签
      const clusterLabel = topKeywords.length > 0 
        ? topKeywords.map(k => k[0]).join('、')
        : `主题${centroid.id + 1}`;
      
      // 创建聚类主题节点
      const clusterNodeId = `cluster_${centroid.id}`;
      nodes.push({
        id: clusterNodeId,
        label: clusterLabel,
        size: 10 + clusterPoints.length, // 大小与包含的记忆数量相关
        category: 'cluster',
        clusterId: `${centroid.id}`
      });
      
      // 步骤2: 为每个聚类中的主要关键词创建节点
      topKeywords.forEach(([keyword, frequency], index) => {
        const keywordNodeId = `keyword_${centroid.id}_${index}`;
        
        // 添加关键词节点
        nodes.push({
          id: keywordNodeId,
          label: keyword,
          size: 5 + Math.min(frequency, 5), // 大小与频率相关
          category: 'keyword',
          clusterId: `${centroid.id}`
        });
        
        // 连接关键词节点到聚类节点
        links.push({
          source: clusterNodeId,
          target: keywordNodeId,
          value: 0.7,
          type: 'contains'
        });
      });
    });
    
    // 步骤3: 增加聚类间的连接，基于共享关键词
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
        
        // 计算交集大小
        const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
        
        // 如果有共享关键词，添加连接
        if (intersection.size > 0) {
          const similarity = intersection.size / Math.min(keywords1.size, keywords2.size);
          
          links.push({
            source: `cluster_${clusterId1}`,
            target: `cluster_${clusterId2}`,
            value: similarity,
            type: 'related'
          });
        }
      }
    }
    
    log(`知识图谱生成完成，包含${nodes.length}个节点和${links.length}个连接`);
    return { nodes, links };
    
  } catch (error) {
    log(`知识图谱生成错误: ${error}`);
    
    // 返回最小化的图谱
    return {
      nodes: memories.slice(0, 5).map((memory, index) => ({
        id: `memory_${memory.id}`,
        label: memory.summary || '记忆项',
        size: 5,
        category: 'memory'
      })),
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
      log(`用户${userId}没有记忆数据，无法生成知识图谱`);
      return { nodes: [], links: [] };
    }
    
    log(`为用户${userId}生成知识图谱，共${memories.length}条记忆`);
    
    // 获取记忆的向量嵌入
    const memoryVectors: { id: string | number; vector: number[] }[] = [];
    
    for (const memory of memories) {
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
      log('没有找到有效的向量嵌入，无法进行聚类');
      return { nodes: [], links: [] };
    }
    
    // 获取记忆关键词
    const memoryKeywords: [string, string[]][] = [];
    
    for (const memory of memories) {
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
    
    // 导入K-means聚类算法
    const { simpleClustering } = await import('./kmeans_clustering');
    
    // 执行聚类
    const clusterResult = simpleClustering(memoryVectors);
    
    // 基于聚类结果生成知识图谱
    return generateKnowledgeGraph(clusterResult, memories, memoryKeywords);
    
  } catch (error) {
    log(`生成用户知识图谱时出错: ${error}`);
    return { nodes: [], links: [] };
  }
}

export default {
  generateKnowledgeGraph,
  generateUserKnowledgeGraph
};