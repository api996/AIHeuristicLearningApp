/**
 * 知识图谱生成器
 * 基于记忆聚类结果构建知识图谱
 */

import { log } from "../../vite";
import { ClusterResult } from "./kmeans_clustering";
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
 * 基于用户ID生成知识图谱
 * @param userId 用户ID
 * @returns 知识图谱
 */
export async function generateUserKnowledgeGraph(userId: number): Promise<KnowledgeGraph> {
  try {
    // 直接从memory_service获取已分析的聚类结果，而不是重新处理所有记忆
    const { clusterResult, clusterCount } = await memoryService.getUserClusters(userId);
    
    if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
      log(`用户${userId}没有有效的聚类结果，返回默认知识图谱`);
      
      // 创建一个最小的默认图谱节点
      return {
        nodes: [
          {
            id: 'cluster_0',
            label: '主题1',
            size: 36,
            category: 'cluster',
            clusterId: '0'
          },
          {
            id: 'cluster_1',
            label: '主题2',
            size: 25,
            category: 'cluster',
            clusterId: '1'
          },
          {
            id: 'cluster_2',
            label: '知识点',
            size: 20,
            category: 'cluster',
            clusterId: '2'
          }
        ],
        links: [
          {
            source: 'cluster_0',
            target: 'cluster_1',
            value: 0.1,
            type: 'proximity'
          },
          {
            source: 'cluster_1',
            target: 'cluster_2',
            value: 0.1,
            type: 'proximity'
          }
        ]
      };
    }
    
    log(`为用户${userId}生成知识图谱，基于${clusterCount}个聚类`);
    
    // 创建节点和连接
    const nodes: KnowledgeNode[] = [];
    const links: KnowledgeLink[] = [];
    
    // 为每个聚类创建一个节点
    clusterResult.centroids.forEach((centroid: any, index: number) => {
      nodes.push({
        id: `cluster_${index}`,
        label: `主题${index + 1}`,
        size: 25 + (centroid.points?.length || 0) * 2, // 基于点数调整大小
        category: 'cluster',
        clusterId: `${index}`
      });
    });
    
    // 创建节点之间的连接，确保图谱连通
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        source: nodes[i].id,
        target: nodes[i+1].id,
        value: 0.1, // 低相似度
        type: 'proximity'
      });
    }
    
    log(`知识图谱生成完成，包含${nodes.length}个节点和${links.length}个连接`);
    return { nodes, links };
  } catch (error) {
    log(`生成用户知识图谱时出错: ${error}`, "error");
    
    // 返回默认图谱
    return {
      nodes: [
        {
          id: 'default_0',
          label: '记忆',
          size: 15,
          category: 'default'
        },
        {
          id: 'default_1',
          label: '知识',
          size: 15,
          category: 'default'
        },
        {
          id: 'default_2',
          label: '学习',
          size: 15,
          category: 'default'
        }
      ],
      links: [
        {
          source: 'default_0',
          target: 'default_1',
          value: 0.2,
          type: 'default'
        },
        {
          source: 'default_1',
          target: 'default_2',
          value: 0.2,
          type: 'default'
        }
      ]
    };
  }
}

export default {
  generateUserKnowledgeGraph
};