/**
 * 主题图谱预加载器
 * 用于优化主题图谱数据的加载体验，提前获取数据并缓存
 */

// 定义主题图谱数据类型（与知识图谱数据结构保持一致以便兼容现有组件）
export interface TopicGraphNode {
  id: string;
  label: string;
  size: number;
  category: string;
  clusterId?: string;
  color?: string;
}

export interface TopicGraphLink {
  source: string;
  target: string;
  value: number;
  type: string;
  color?: string;
}

export interface TopicGraphData {
  nodes: TopicGraphNode[];
  links: TopicGraphLink[];
  version?: number;
  fromCache?: boolean;
}

// 内存缓存
let cachedGraphData: Map<number, TopicGraphData> = new Map();
let pendingPromises: Map<number, Promise<TopicGraphData>> = new Map();

/**
 * 预加载主题图谱数据
 * @param userId 用户ID
 * @param forceRefresh 是否强制刷新缓存
 * @returns 承诺主题图谱数据
 */
export async function preloadTopicGraphData(userId: number, forceRefresh: boolean = false): Promise<TopicGraphData> {
  console.log("预加载智能主题图谱数据...", forceRefresh ? "(强制刷新)" : "");
  
  // 显示预计处理时间信息
  const startTime = performance.now();
  
  // 如果强制刷新，清除现有缓存
  if (forceRefresh) {
    console.log(`强制刷新用户${userId}的主题图谱缓存`);
    cachedGraphData.delete(userId);
    pendingPromises.delete(userId);
  } else {
    // 检查内存中是否有缓存
    if (cachedGraphData.has(userId)) {
      const cachedData = cachedGraphData.get(userId)!;
      console.log(`使用内存缓存的主题图谱数据: ${cachedData.nodes.length}个节点`);
      return cachedData;
    }
  }
  
  // 检查是否已经有正在进行的请求
  if (pendingPromises.has(userId)) {
    console.log(`已有相同的请求正在处理中，等待结果...`);
    return pendingPromises.get(userId)!;
  }
  
  // 创建新的获取请求
  const promise = forceRefresh 
    ? fetchTopicGraphDataForceRefresh(userId)  // 强制刷新时使用缓存破坏版本
    : fetchTopicGraphData(userId);             // 正常情况使用不破坏缓存的版本
    
  pendingPromises.set(userId, promise);
  
  try {
    const data = await promise;
    // 成功后更新缓存并移除进行中的请求
    cachedGraphData.set(userId, data);
    pendingPromises.delete(userId);
    
    // 计算加载时间并显示性能指标
    const loadTime = (performance.now() - startTime).toFixed(0);
    console.log(`主题图谱数据预加载成功: ${data.nodes.length}个节点, ${data.links.length}个连接，总耗时: ${loadTime}ms`);
    
    return data;
  } catch (error) {
    // 请求失败时也移除进行中的请求，允许重试
    pendingPromises.delete(userId);
    console.error("预加载主题图谱数据失败:", error);
    
    // 如果失败但存在有效缓存，返回缓存数据
    if (cachedGraphData.has(userId)) {
      console.log(`请求失败但发现有效缓存，使用缓存数据`);
      return cachedGraphData.get(userId)!;
    }
    
    // 创建一个最小默认图谱
    console.log(`无法获取主题图谱数据且无缓存，返回空图谱`);
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
 * 获取已缓存的主题图谱数据
 * @param userId 用户ID
 * @returns 承诺主题图谱数据
 */
export async function getTopicGraphData(userId: number): Promise<TopicGraphData> {
  console.log("获取主题图谱数据，用户ID:", userId);
  
  // 如果有缓存，直接返回
  if (cachedGraphData.has(userId)) {
    console.log("使用缓存的主题图谱数据");
    return cachedGraphData.get(userId)!;
  }
  
  // 如果有正在进行的请求，等待它完成
  if (pendingPromises.has(userId)) {
    return pendingPromises.get(userId)!;
  }
  
  // 如果没有缓存也没有进行中的请求，开始新的请求
  return preloadTopicGraphData(userId);
}

/**
 * 清除缓存的主题图谱数据
 * @param userId 用户ID，不提供则清除所有用户的缓存
 */
export function clearTopicGraphCache(userId?: number): void {
  if (userId !== undefined) {
    cachedGraphData.delete(userId);
    pendingPromises.delete(userId);
    console.log(`已清除用户${userId}的主题图谱缓存`);
  } else {
    cachedGraphData.clear();
    pendingPromises.clear();
    console.log("已清除所有主题图谱缓存");
  }
}

/**
 * 基本主题图谱数据获取函数 - 无缓存破坏版本
 * @param userId 用户ID
 * @returns 承诺主题图谱数据
 */
async function fetchTopicGraphData(userId: number): Promise<TopicGraphData> {
  try {
    // 使用新的主题图谱API
    const response = await fetch(`/api/topic-graph/${userId}`, {
      headers: {
        // 允许使用缓存
        'Cache-Control': 'max-age=300' // 5分钟缓存
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取主题图谱失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 验证数据结构有效性
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error("收到无效的主题图谱数据格式:", data);
      throw new Error("主题图谱数据格式无效");
    }
    
    console.log("主题图谱数据成功获取:", data.nodes.length, "个节点,", data.links.length, "个连接");
    
    // 检查数据示例 (只记录日志，不影响流程)
    if (data.nodes.length > 0 && data.links.length > 0) {
      console.log("数据示例 - 主题节点:", data.nodes[0], "连接:", data.links[0]);
    }
    
    return data;
  } catch (error) {
    console.error("获取主题图谱数据失败:", error);
    throw error;
  }
}

/**
 * 带缓存破坏的主题图谱数据获取函数 - 仅用于强制刷新
 * @param userId 用户ID
 * @returns 承诺主题图谱数据
 */
async function fetchTopicGraphDataForceRefresh(userId: number): Promise<TopicGraphData> {
  try {
    // 使用POST请求强制刷新
    const response = await fetch(`/api/topic-graph/${userId}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`刷新主题图谱失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 验证数据结构有效性
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error("刷新后收到无效的主题图谱数据格式:", data);
      throw new Error("主题图谱数据格式无效");
    }
    
    console.log("主题图谱数据刷新成功:", data.nodes.length, "个节点", data.links.length, "个连接");
    return data;
  } catch (error) {
    console.error("刷新主题图谱数据失败:", error);
    throw error;
  }
}