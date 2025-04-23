/**
 * 知识图谱生成器
 * 基于记忆聚类结果构建知识图谱
 */

import { log } from "../../vite";
import { ClusterResult } from "./cluster_types";
import { storage } from "../../storage";
import { Memory } from "@shared/schema";
import { memoryService } from "./memory_service";

/**
 * 知识图谱节点接口
 */
export interface KnowledgeNode {
  id: string;           // 节点唯一标识
  label: string;        // 节点标签/名称
  size: number;         // 节点大小（代表重要性）
  category?: string;    // 节点类别（主题、概念、关键词等）
  clusterId?: string;   // 关联的聚类ID
  color?: string;       // 节点颜色（与学习路径数据格式保持一致）
}

/**
 * 知识图谱连接接口
 */
export interface KnowledgeLink {
  source: string;           // 源节点ID
  target: string;           // 目标节点ID
  value: number;            // 连接强度（0-1之间）
  type?: string;            // 连接类型
  color?: string;           // 连接颜色
  learningOrder?: number;   // 学习顺序（与学习路径保持一致）
  reason?: string;          // 连接理由
  strength?: number;        // 连接强度（与学习路径保持一致）
}

/**
 * 知识图谱接口
 */
export interface KnowledgeGraph {
  nodes: KnowledgeNode[];  // 图谱节点
  links: KnowledgeLink[];  // 图谱连接
}

/**
 * 基于用户ID生成知识图谱
 * @param userId 用户ID
 * @param forceRefresh 是否强制刷新缓存
 * @returns 知识图谱
 */
export async function generateUserKnowledgeGraph(userId: number, forceRefresh: boolean = false): Promise<KnowledgeGraph> {
  try {
    // 如果不是强制刷新，先尝试从缓存获取
    if (!forceRefresh) {
      const cachedGraph = await storage.getKnowledgeGraphCache(userId);
      if (cachedGraph) {
        log(`使用缓存的知识图谱，用户ID=${userId}，版本=${cachedGraph.version}`);
        return {
          nodes: cachedGraph.nodes as KnowledgeNode[],
          links: cachedGraph.links as KnowledgeLink[]
        };
      }
      log(`未找到用户${userId}的知识图谱缓存或缓存已过期，将重新生成`);
    } else {
      log(`强制刷新用户${userId}的知识图谱，跳过缓存`);
    }
    
    // 直接从memory_service获取已分析的聚类结果，而不是重新处理所有记忆
    // 传递forceRefresh参数，确保在需要时获得最新数据
    const { clusterResult, clusterCount } = await memoryService.getUserClusters(userId, forceRefresh);
    
    if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
      log(`用户${userId}没有有效的聚类结果，返回默认知识图谱`);
      
      // 创建一个最小的默认图谱节点
      const defaultGraph = {
        nodes: [
          {
            id: 'cluster_0',
            label: '主题1',
            size: 36,
            category: 'cluster',
            clusterId: '0',
            color: '#6366f1' // 添加颜色属性
          },
          {
            id: 'cluster_1',
            label: '主题2',
            size: 25,
            category: 'cluster',
            clusterId: '1',
            color: '#f43f5e' // 添加颜色属性
          },
          {
            id: 'cluster_2',
            label: '知识点',
            size: 20,
            category: 'cluster',
            clusterId: '2',
            color: '#22c55e' // 添加颜色属性
          }
        ],
        links: [
          {
            source: 'cluster_0',
            target: 'cluster_1',
            value: 0.1,
            type: 'proximity',
            color: '#6366f1', // 添加颜色属性
            learningOrder: 1, // 添加学习顺序
            reason: "学习入门", // 默认原因
            strength: 0.5 // 默认强度
          },
          {
            source: 'cluster_1',
            target: 'cluster_2',
            value: 0.1,
            type: 'proximity',
            color: '#f43f5e', // 添加颜色属性
            learningOrder: 2, // 添加学习顺序
            reason: "进阶学习", // 默认原因
            strength: 0.5 // 默认强度
          }
        ]
      };
      
      // 将默认图谱也缓存起来，有效期2小时
      await storage.saveKnowledgeGraphCache(userId, defaultGraph.nodes, defaultGraph.links, 2);
      
      return defaultGraph;
    }
    
    log(`为用户${userId}生成知识图谱，基于${clusterCount}个聚类`);
    
    // 创建节点和连接
    const nodes: KnowledgeNode[] = [];
    const links: KnowledgeLink[] = [];
    
    // 为节点预生成相同的颜色集
    const themeColors = [
      '#6366f1', // 靛蓝色
      '#f43f5e', // 粉红色
      '#22c55e', // 绿色
      '#eab308', // 黄色
      '#14b8a6', // 青色
      '#f97316', // 橙色
      '#06b6d4', // 天蓝色
      '#a855f7', // 紫罗兰色
    ];
    
    // 为每个聚类创建一个节点
    clusterResult.centroids.forEach((centroid: any, index: number) => {
      const colorIndex = index % themeColors.length;
      nodes.push({
        id: `cluster_${index}`,
        label: `主题${index + 1}`,
        size: 25 + (centroid.points?.length || 0) * 2, // 基于点数调整大小
        category: 'cluster',
        clusterId: `${index}`,
        color: themeColors[colorIndex] // 添加颜色属性
      });
    });
    
    // 创建节点之间的连接，确保图谱连通
    for (let i = 0; i < nodes.length - 1; i++) {
      const colorIndex = i % themeColors.length;
      links.push({
        source: nodes[i].id,
        target: nodes[i+1].id,
        value: 0.1, // 低相似度
        type: 'proximity',
        color: themeColors[colorIndex], // 添加颜色属性
        learningOrder: i + 1, // 添加学习顺序
        reason: "建议学习路径", // 默认原因
        strength: 0.5 // 默认强度
      });
    }
    
    // 只有创建了有效的图谱才缓存
    if (nodes.length > 0 && links.length > 0) {
      log(`将知识图谱保存到缓存，包含${nodes.length}个节点和${links.length}个连接`);
      // 缓存图谱，有效期24小时
      await storage.saveKnowledgeGraphCache(userId, nodes, links, 24);
    }
    
    log(`知识图谱生成完成，包含${nodes.length}个节点和${links.length}个连接`);
    return { nodes, links };
  } catch (error) {
    log(`生成用户知识图谱时出错: ${error}`, "error");
    
    // 返回默认图谱
    const defaultGraph = {
      nodes: [
        {
          id: 'default_0',
          label: '记忆',
          size: 15,
          category: 'default',
          clusterId: '0',
          color: '#6366f1' // 添加颜色属性
        },
        {
          id: 'default_1',
          label: '知识',
          size: 15,
          category: 'default',
          clusterId: '1',
          color: '#f43f5e' // 添加颜色属性
        },
        {
          id: 'default_2',
          label: '学习',
          size: 15,
          category: 'default',
          clusterId: '2',
          color: '#22c55e' // 添加颜色属性
        }
      ],
      links: [
        {
          source: 'default_0',
          target: 'default_1',
          value: 0.2,
          type: 'default',
          color: '#6366f1', // 添加颜色属性
          learningOrder: 1, // 添加学习顺序
          reason: "记忆积累", // 默认原因
          strength: 0.6 // 默认强度
        },
        {
          source: 'default_1',
          target: 'default_2',
          value: 0.2,
          type: 'default',
          color: '#f43f5e', // 添加颜色属性
          learningOrder: 2, // 添加学习顺序
          reason: "知识应用", // 默认原因
          strength: 0.6 // 默认强度
        }
      ]
    };
    
    // 出错时也尝试缓存默认图谱，但有效期短一些
    try {
      await storage.saveKnowledgeGraphCache(userId, defaultGraph.nodes, defaultGraph.links, 1);
    } catch (cacheError) {
      log(`缓存默认知识图谱时出错: ${cacheError}`, "error");
    }
    
    return defaultGraph;
  }
}

export default {
  generateUserKnowledgeGraph
};