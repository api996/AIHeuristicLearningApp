/**
 * 知识图谱数据预加载器
 * 用于提前加载知识图谱数据，减少用户等待时间
 */

import { apiRequest } from '@/lib/queryClient';

interface GraphNode {
  id: string;
  label: string;
  size: number;
  category: string;
}

interface GraphLink {
  source: string;
  target: string;
  value?: number;
}

interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// 缓存对象
const graphDataCache: Record<string, {
  data: KnowledgeGraphData;
  timestamp: number;
  isLoading: boolean;
  loadPromise: Promise<KnowledgeGraphData> | null;
}> = {};

// 缓存有效期（10分钟）
const CACHE_TTL = 10 * 60 * 1000;

/**
 * 预加载知识图谱数据
 * @param userId 用户ID
 * @returns 加载Promise
 */
export async function preloadKnowledgeGraphData(userId: number | string): Promise<KnowledgeGraphData> {
  const cacheKey = `user_${userId}`;
  
  // 检查缓存是否有效
  if (
    graphDataCache[cacheKey] && 
    graphDataCache[cacheKey].data && 
    Date.now() - graphDataCache[cacheKey].timestamp < CACHE_TTL
  ) {
    console.log('使用缓存的知识图谱数据');
    return graphDataCache[cacheKey].data;
  }
  
  // 如果已经有加载中的请求，直接返回该Promise
  if (graphDataCache[cacheKey]?.isLoading && graphDataCache[cacheKey]?.loadPromise) {
    console.log('正在加载知识图谱数据，使用现有请求');
    return graphDataCache[cacheKey].loadPromise as Promise<KnowledgeGraphData>;
  }
  
  // 创建新的加载Promise
  console.log('预加载知识图谱数据...');
  
  const loadPromise = apiRequest<KnowledgeGraphData>(`/api/learning-path/${userId}/knowledge-graph`)
    .then((data) => {
      // 如果数据为空或无效，返回空结构
      if (!data || !data.nodes || !data.links) {
        return { nodes: [], links: [] };
      }
      
      // 处理和格式化数据
      const formattedData = {
        nodes: data.nodes.map(node => ({
          ...node,
          // 确保节点大小合适
          size: node.category === 'cluster' ? 15 : 
                node.category === 'keyword' ? 10 : 8,
          color: node.category === 'cluster' ? '#3b82f6' : 
                node.category === 'keyword' ? '#10b981' : 
                '#eab308'
        })),
        links: data.links.map(link => ({
          ...link,
          // 确保线条可见
          value: link.value || 1,
          color: 'rgba(100, 180, 255, 0.7)'
        }))
      };
      
      // 更新缓存
      graphDataCache[cacheKey] = {
        data: formattedData,
        timestamp: Date.now(),
        isLoading: false,
        loadPromise: null
      };
      
      console.log(`知识图谱数据加载完成: ${formattedData.nodes.length}个节点, ${formattedData.links.length}个连接`);
      return formattedData;
    })
    .catch((error) => {
      console.error('加载知识图谱数据失败:', error);
      graphDataCache[cacheKey].isLoading = false;
      graphDataCache[cacheKey].loadPromise = null;
      throw error;
    });
    
  // 更新缓存状态
  graphDataCache[cacheKey] = {
    data: { nodes: [], links: [] },
    timestamp: 0,
    isLoading: true,
    loadPromise
  };
  
  return loadPromise;
}

/**
 * 获取知识图谱数据（如果已预加载则立即返回）
 * @param userId 用户ID
 * @returns 知识图谱数据或Promise
 */
export function getKnowledgeGraphData(userId: number | string): Promise<KnowledgeGraphData> {
  return preloadKnowledgeGraphData(userId);
}

/**
 * 清除知识图谱缓存
 * @param userId 用户ID，如果不指定则清除所有缓存
 */
export function clearKnowledgeGraphCache(userId?: number | string): void {
  if (userId) {
    const cacheKey = `user_${userId}`;
    delete graphDataCache[cacheKey];
    console.log(`已清除用户 ${userId} 的知识图谱缓存`);
  } else {
    Object.keys(graphDataCache).forEach(key => delete graphDataCache[key]);
    console.log('已清除所有知识图谱缓存');
  }
}