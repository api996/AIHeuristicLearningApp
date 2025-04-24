/**
 * 统一图谱预加载器
 * 完全统一了图谱数据结构和API，移除了多余的主题图谱概念
 * 所有调用都被路由到知识图谱API，完全消除技术债务和重复代码
 */

// 定义统一图谱数据类型
export interface GraphNode {
  id: string;
  label: string;
  size: number;
  category: string;
  clusterId?: string;
  color?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: string;
  label?: string;
  reason?: string;
  color?: string;
  strength?: number;
  learningOrder?: string;
  bidirectional?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  version?: number;
  fromCache?: boolean;
}

// 内存缓存
const cachedGraphData: Map<string, GraphData> = new Map();
const pendingPromises: Map<string, Promise<GraphData>> = new Map();

// 缓存键生成
function getCacheKey(userId: number, graphType: 'knowledge' | 'topic'): string {
  return `${graphType}-${userId}`;
}

/**
 * 预加载图谱数据
 * @param userId 用户ID
 * @param graphType 图谱类型 ('knowledge' | 'topic')
 * @param forceRefresh 是否强制刷新缓存
 * @returns 承诺图谱数据
 */
export async function preloadGraphData(
  userId: number, 
  graphType: 'knowledge' | 'topic' = 'knowledge', 
  forceRefresh: boolean = false
): Promise<GraphData> {
  const cacheKey = getCacheKey(userId, graphType);
  const graphTypeName = graphType === 'knowledge' ? '知识图谱' : '主题图谱';
  
  console.log(`预加载${graphTypeName}数据...`, forceRefresh ? "(强制刷新)" : "");
  
  // 性能计时开始
  const startTime = performance.now();
  
  // 如果强制刷新，清除现有缓存
  if (forceRefresh) {
    console.log(`强制刷新用户${userId}的${graphTypeName}缓存`);
    cachedGraphData.delete(cacheKey);
    pendingPromises.delete(cacheKey);
  } else {
    // 检查内存中是否有缓存
    if (cachedGraphData.has(cacheKey)) {
      const cachedData = cachedGraphData.get(cacheKey)!;
      console.log(`使用内存缓存的${graphTypeName}数据: ${cachedData.nodes.length}个节点`);
      return cachedData;
    }
  }
  
  // 检查是否已经有正在进行的请求
  if (pendingPromises.has(cacheKey)) {
    console.log(`已有相同的请求正在处理中，等待结果...`);
    return pendingPromises.get(cacheKey)!;
  }
  
  // 创建新的获取请求 - 统一使用知识图谱API
  // 注意：无论要求的是什么类型的图谱，我们都使用知识图谱API
  const promise = forceRefresh
    ? fetchKnowledgeGraphDataForceRefresh(userId)
    : fetchKnowledgeGraphData(userId);
  
  pendingPromises.set(cacheKey, promise);
  
  try {
    const data = await promise;
    // 成功后更新缓存并移除进行中的请求
    cachedGraphData.set(cacheKey, data);
    pendingPromises.delete(cacheKey);
    
    // 计算加载时间并显示性能指标
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`${graphTypeName}数据预加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接，总耗时: ${loadTime}ms`);
    
    return data;
  } catch (error) {
    // 请求失败时也移除进行中的请求，允许重试
    pendingPromises.delete(cacheKey);
    console.error(`预加载${graphTypeName}数据失败:`, error);
    
    // 如果失败但存在有效缓存，返回缓存数据
    if (cachedGraphData.has(cacheKey)) {
      console.log(`请求失败但发现有效缓存，使用缓存数据`);
      return cachedGraphData.get(cacheKey)!;
    }
    
    // 创建一个最小默认图谱
    console.log(`无法获取${graphTypeName}数据且无缓存，返回空图谱`);
    return {
      nodes: [
        {
          id: 'default-node',
          label: '暂无数据',
          size: 20,
          category: 'cluster',
          color: '#888888'
        }
      ],
      links: []
    };
  }
}

/**
 * 获取已缓存的图谱数据
 * @param userId 用户ID
 * @param graphType 图谱类型 ('knowledge' | 'topic')
 * @returns 承诺图谱数据
 */
export async function getGraphData(
  userId: number, 
  graphType: 'knowledge' | 'topic' = 'knowledge'
): Promise<GraphData> {
  const cacheKey = getCacheKey(userId, graphType);
  const graphTypeName = graphType === 'knowledge' ? '知识图谱' : '主题图谱';
  
  console.log(`获取${graphTypeName}数据，用户ID:`, userId);
  
  // 如果有缓存，直接返回
  if (cachedGraphData.has(cacheKey)) {
    console.log(`使用缓存的${graphTypeName}数据`);
    return cachedGraphData.get(cacheKey)!;
  }
  
  // 如果有正在进行的请求，等待它完成
  if (pendingPromises.has(cacheKey)) {
    return pendingPromises.get(cacheKey)!;
  }
  
  // 如果没有缓存也没有进行中的请求，开始新的请求
  return preloadGraphData(userId, graphType);
}

/**
 * 清除缓存的图谱数据
 * @param userId 用户ID，不提供则清除所有用户的缓存
 * @param graphType 图谱类型，不提供则清除所有类型
 */
export function clearGraphCache(userId?: number, graphType?: 'knowledge' | 'topic'): void {
  if (userId !== undefined) {
    if (graphType !== undefined) {
      // 清除特定用户的特定图谱类型
      const cacheKey = getCacheKey(userId, graphType);
      cachedGraphData.delete(cacheKey);
      pendingPromises.delete(cacheKey);
      console.log(`已清除用户${userId}的${graphType === 'knowledge' ? '知识图谱' : '主题图谱'}缓存`);
    } else {
      // 清除特定用户的所有图谱
      const knowledgeKey = getCacheKey(userId, 'knowledge');
      const topicKey = getCacheKey(userId, 'topic');
      cachedGraphData.delete(knowledgeKey);
      cachedGraphData.delete(topicKey);
      pendingPromises.delete(knowledgeKey);
      pendingPromises.delete(topicKey);
      console.log(`已清除用户${userId}的所有图谱缓存`);
    }
  } else {
    // 清除所有缓存
    cachedGraphData.clear();
    pendingPromises.clear();
    console.log("已清除所有图谱缓存");
  }
}

/**
 * 为了向后兼容，保留原来的API名称
 */
export async function preloadKnowledgeGraphData(userId: number, forceRefresh: boolean = false): Promise<GraphData> {
  return preloadGraphData(userId, 'knowledge', forceRefresh);
}

export async function preloadTopicGraphData(userId: number, forceRefresh: boolean = false): Promise<GraphData> {
  return preloadGraphData(userId, 'topic', forceRefresh);
}

export async function getKnowledgeGraphData(userId: number): Promise<GraphData> {
  return getGraphData(userId, 'knowledge');
}

export async function getTopicGraphData(userId: number): Promise<GraphData> {
  return getGraphData(userId, 'topic');
}

export function clearKnowledgeGraphCache(userId?: number): void {
  clearGraphCache(userId, 'knowledge');
}

export function clearTopicGraphCache(userId?: number): void {
  clearGraphCache(userId, 'topic');
}

// 兼容类型别名，确保现有代码不会产生类型错误
export type KnowledgeGraphData = GraphData;
export type TopicGraphData = GraphData;
export type KnowledgeGraphNode = GraphNode;
export type TopicGraphNode = GraphNode;
export type KnowledgeGraphLink = GraphLink;
export type TopicGraphLink = GraphLink;

/**
 * 简化版知识图谱数据获取函数 - 无缓存破坏版本
 * @param userId 用户ID
 * @returns 承诺知识图谱数据
 */
async function fetchKnowledgeGraphData(userId: number): Promise<GraphData> {
  try {
    const response = await fetch(`/api/learning-path/${userId}/knowledge-graph`, {
      headers: {
        'Cache-Control': 'max-age=300' // 5分钟缓存
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取知识图谱失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 验证数据结构有效性
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error("收到无效的知识图谱数据格式:", data);
      throw new Error("知识图谱数据格式无效");
    }
    
    console.log("知识图谱数据成功获取:", data.nodes.length, "个节点,", data.links.length, "个连接");
    
    // 处理边的类型和颜色
    processLinkColors(data);
    
    return data;
  } catch (error) {
    console.error("获取知识图谱数据失败:", error);
    throw error;
  }
}

/**
 * 带缓存破坏的知识图谱数据获取函数 - 仅用于强制刷新
 * @param userId 用户ID
 * @returns 承诺知识图谱数据
 */
async function fetchKnowledgeGraphDataForceRefresh(userId: number): Promise<GraphData> {
  try {
    const timestamp = Date.now();
    const response = await fetch(`/api/learning-path/${userId}/knowledge-graph?refresh=true&t=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取知识图谱失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 验证数据结构有效性
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error("刷新后收到无效的知识图谱数据格式:", data);
      throw new Error("知识图谱数据格式无效");
    }
    
    // 处理边的类型和颜色
    processLinkColors(data);
    
    console.log("知识图谱数据刷新成功:", data.nodes.length, "个节点", data.links.length, "个连接");
    return data;
  } catch (error) {
    console.error("刷新知识图谱数据失败:", error);
    throw error;
  }
}

/**
 * 主题图谱数据获取函数 - 统一使用知识图谱API
 * @param userId 用户ID
 * @returns 承诺主题图谱数据（实际上是知识图谱数据）
 */
async function fetchTopicGraphData(userId: number): Promise<GraphData> {
  console.log("主题图谱功能现已与知识图谱合并，使用知识图谱API代替");
  return fetchKnowledgeGraphData(userId);
}

/**
 * 带缓存破坏的主题图谱数据获取函数 - 统一使用知识图谱API
 * @param userId 用户ID
 * @returns 承诺主题图谱数据（实际上是知识图谱数据）
 */
async function fetchTopicGraphDataForceRefresh(userId: number): Promise<GraphData> {
  console.log("主题图谱功能现已与知识图谱合并，使用知识图谱API代替");
  return fetchKnowledgeGraphDataForceRefresh(userId);
}

/**
 * 统一处理连接线的颜色，确保始终基于type属性来设置颜色
 * @param data 图谱数据
 */
function processLinkColors(data: GraphData): void {
  // 如果links数组为空或undefined，直接返回
  if (!data.links || !Array.isArray(data.links) || data.links.length === 0) {
    return;
  }

  // 遍历所有连接，确保根据type设置颜色
  for (const link of data.links) {
    // 如果已有颜色且颜色不是默认的灰色，则保留
    if (link.color && !link.color.includes('rgb(156, 163, 175)') && !link.color.includes('#9ca3af')) {
      continue;
    }

    // 根据类型分配颜色
    switch (link.type) {
      case 'prerequisite':
        link.color = 'rgba(220, 38, 38, 0.7)'; // 先决条件 - 深红色
        break;
      case 'contains':
        link.color = 'rgba(59, 102, 241, 0.7)'; // 包含关系 - 靛蓝色
        break;
      case 'applies':
        link.color = 'rgba(14, 165, 233, 0.7)'; // 应用关系 - 天蓝色
        break;
      case 'similar':
        link.color = 'rgba(16, 185, 129, 0.7)'; // 相似概念 - 绿色
        break;
      case 'complements':
        link.color = 'rgba(245, 158, 11, 0.7)'; // 互补知识 - 琥珀色
        break;
      case 'references':
        link.color = 'rgba(139, 92, 246, 0.7)'; // 引用关系 - 紫色
        break;
      case 'related':
        link.color = 'rgba(79, 70, 229, 0.7)'; // 相关概念 - 靛紫色
        break;
      case 'unrelated':
        link.color = 'rgba(156, 163, 175, 0.5)'; // 无直接关系 - 浅灰色
        break;
      default:
        link.color = 'rgba(59, 130, 246, 0.6)'; // 默认 - 蓝色
    }
  }
}