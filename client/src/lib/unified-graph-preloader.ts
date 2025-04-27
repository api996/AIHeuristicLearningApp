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

// 本地存储持久化缓存键前缀
const LOCAL_STORAGE_PREFIX = 'graph_cache_';

// 获取本地存储缓存键
function getLocalStorageKey(userId: number, graphType: 'knowledge' | 'topic'): string {
  return `${LOCAL_STORAGE_PREFIX}${graphType}_${userId}`;
}

// 缓存有效期（毫秒）- 24小时
const CACHE_TTL = 24 * 60 * 60 * 1000;

// 将图谱数据保存到本地存储
function saveToLocalStorage(key: string, data: GraphData): void {
  try {
    const cacheItem = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
    console.log(`图谱数据已保存到本地存储: ${key}, 节点数: ${data.nodes.length}, 连接数: ${data.links.length}`);
  } catch (error) {
    console.warn(`保存图谱数据到本地存储失败: ${error}`);
    // 尝试清理旧缓存释放空间
    clearOldLocalCache();
  }
}

// 从本地存储获取图谱数据
function getFromLocalStorage(key: string): GraphData | null {
  try {
    const cacheItem = localStorage.getItem(key);
    if (!cacheItem) return null;
    
    const { data, timestamp } = JSON.parse(cacheItem);
    
    // 检查缓存是否过期
    if (Date.now() - timestamp > CACHE_TTL) {
      console.log(`本地缓存已过期: ${key}`);
      localStorage.removeItem(key);
      return null;
    }
    
    console.log(`从本地存储加载图谱数据: ${key}, 节点数: ${data.nodes.length}, 连接数: ${data.links.length}`);
    return data;
  } catch (error) {
    console.warn(`从本地存储读取图谱数据失败: ${error}`);
    return null;
  }
}

// 清理超过7天的所有本地缓存
function clearOldLocalCache(): void {
  try {
    const now = Date.now();
    const OLDER_THAN = 7 * 24 * 60 * 60 * 1000; // 7天
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(LOCAL_STORAGE_PREFIX)) {
        try {
          const cacheItem = JSON.parse(localStorage.getItem(key) || '{}');
          if (cacheItem.timestamp && (now - cacheItem.timestamp > OLDER_THAN)) {
            localStorage.removeItem(key);
            console.log(`已清理过期本地缓存: ${key}`);
          }
        } catch (e) {
          // 如果解析失败，也清理掉这个缓存项
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.warn(`清理旧缓存失败: ${error}`);
  }
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
  const localStorageKey = getLocalStorageKey(userId, graphType);
  const graphTypeName = graphType === 'knowledge' ? '知识图谱' : '主题图谱';
  
  console.log(`预加载${graphTypeName}数据...`, forceRefresh ? "(强制刷新)" : "");
  
  // 性能计时开始
  const startTime = performance.now();
  
  // 如果强制刷新，清除现有缓存
  if (forceRefresh) {
    console.log(`强制刷新用户${userId}的${graphTypeName}缓存`);
    cachedGraphData.delete(cacheKey);
    pendingPromises.delete(cacheKey);
    localStorage.removeItem(localStorageKey);
  } else {
    // 检查内存中是否有缓存
    if (cachedGraphData.has(cacheKey)) {
      const cachedData = cachedGraphData.get(cacheKey)!;
      console.log(`使用内存缓存的${graphTypeName}数据: ${cachedData.nodes.length}个节点`);
      return cachedData;
    }
    
    // 检查本地存储是否有缓存
    const localData = getFromLocalStorage(localStorageKey);
    if (localData) {
      console.log(`从本地存储加载${graphTypeName}数据: ${localData.nodes.length}个节点`);
      // 将本地存储的数据添加到内存缓存中，避免重复加载
      cachedGraphData.set(cacheKey, localData);
      // 设置 fromCache 标记，表示数据来自缓存
      localData.fromCache = true;
      return localData;
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
    
  // 输出日志确认所有图谱请求都指向知识图谱API
  console.log(`统一调用: ${graphType}图谱请求 -> 知识图谱API`);
  
  pendingPromises.set(cacheKey, promise);
  
  try {
    const data = await promise;
    // 成功后更新缓存并移除进行中的请求
    cachedGraphData.set(cacheKey, data);
    pendingPromises.delete(cacheKey);
    
    // 保存到本地存储以实现持久化
    saveToLocalStorage(localStorageKey, data);
    
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
      console.log(`请求失败但发现内存缓存，使用缓存数据`);
      return cachedGraphData.get(cacheKey)!;
    }
    
    // 检查本地存储是否有缓存作为备份
    const localData = getFromLocalStorage(localStorageKey);
    if (localData) {
      console.log(`请求失败但发现本地存储缓存，使用本地缓存数据`);
      // 将本地存储的数据添加到内存缓存中，避免重复加载
      cachedGraphData.set(cacheKey, localData);
      return localData;
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
      const localStorageKey = getLocalStorageKey(userId, graphType);
      
      // 清除内存缓存
      cachedGraphData.delete(cacheKey);
      pendingPromises.delete(cacheKey);
      
      // 清除本地存储缓存
      try {
        localStorage.removeItem(localStorageKey);
      } catch (e) {
        console.warn(`清除本地存储缓存出错: ${e}`);
      }
      
      console.log(`已清除用户${userId}的${graphType === 'knowledge' ? '知识图谱' : '主题图谱'}缓存`);
    } else {
      // 清除特定用户的所有图谱
      const knowledgeKey = getCacheKey(userId, 'knowledge');
      const topicKey = getCacheKey(userId, 'topic');
      const localKnowledgeKey = getLocalStorageKey(userId, 'knowledge');
      const localTopicKey = getLocalStorageKey(userId, 'topic');
      
      // 清除内存缓存
      cachedGraphData.delete(knowledgeKey);
      cachedGraphData.delete(topicKey);
      pendingPromises.delete(knowledgeKey);
      pendingPromises.delete(topicKey);
      
      // 清除本地存储缓存
      try {
        localStorage.removeItem(localKnowledgeKey);
        localStorage.removeItem(localTopicKey);
      } catch (e) {
        console.warn(`清除本地存储缓存出错: ${e}`);
      }
      
      console.log(`已清除用户${userId}的所有图谱缓存`);
    }
  } else {
    // 清除所有缓存
    cachedGraphData.clear();
    pendingPromises.clear();
    
    // 清除所有本地存储图谱缓存
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(LOCAL_STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn(`清除所有本地存储缓存出错: ${e}`);
    }
    
    console.log("已清除所有图谱缓存（内存和本地存储）");
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
  console.log("【统一请求】主题图谱请求被重定向到知识图谱API");
  
  // 直接调用知识图谱API，完全移除主题图谱概念
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
    
    console.log("【统一图谱】成功获取知识图谱数据替代主题图谱:", data.nodes.length, "个节点");
    
    // 处理边的类型和颜色
    processLinkColors(data);
    
    return data;
  } catch (error) {
    console.error("【统一图谱】获取替代主题图谱的知识图谱数据失败:", error);
    throw error;
  }
}

/**
 * 带缓存破坏的主题图谱数据获取函数 - 统一使用知识图谱API
 * @param userId 用户ID
 * @returns 承诺主题图谱数据（实际上是知识图谱数据）
 */
async function fetchTopicGraphDataForceRefresh(userId: number): Promise<GraphData> {
  console.log("【统一请求】带强制刷新的主题图谱请求被重定向到知识图谱API");
  
  // 直接调用知识图谱强制刷新API，完全移除主题图谱概念
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
      throw new Error(`强制刷新获取知识图谱失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // 验证数据结构有效性
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error("刷新后收到无效的知识图谱数据格式:", data);
      throw new Error("知识图谱数据格式无效");
    }
    
    // 处理边的类型和颜色
    processLinkColors(data);
    
    console.log("【统一图谱】成功刷新获取知识图谱数据替代主题图谱:", data.nodes.length, "个节点");
    return data;
  } catch (error) {
    console.error("【统一图谱】强制刷新获取替代主题图谱的知识图谱数据失败:", error);
    throw error;
  }
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

  // 关系类型映射到颜色
  const relationColorMap: Record<string, string> = {
    "prerequisite": "#DC2626", // 前置知识 - 深红色
    "contains": "#4F46E5",     // 包含关系 - 靛蓝色
    "references": "#9333EA",   // 引用关系 - 紫色
    "applies": "#0EA5E9",      // 应用关系 - 天蓝色
    "similar": "#10B981",      // 相似概念 - 绿色
    "complements": "#F59E0B",  // 互补知识 - 琥珀色
    "related": "#6D28D9",      // 相关概念 - 深紫色
    "unrelated": "#D1D5DB"     // 无关联 - 浅灰色
  };

  console.log(`正在分析${data.links.length}条连接的颜色信息`);
  
  // 记录关系类型数量统计
  const typeCount: Record<string, number> = {};
  
  // 处理每条连接的颜色
  for (const link of data.links) {
    // 统计各类型数量
    typeCount[link.type] = (typeCount[link.type] || 0) + 1;
    
    // 保留原始类型，只为颜色赋值
    if (link.type) {
      // 如果类型存在但没有对应颜色，保留原始类型
      if (relationColorMap[link.type]) {
        // 有对应颜色映射时，使用映射的颜色
        link.color = relationColorMap[link.type];
      } else {
        // 类型不在预定义映射中但类型存在，使用默认颜色但保留类型
        console.log(`发现未知关系类型: ${link.type}，保留原始类型但使用默认颜色`);
        link.color = relationColorMap['related']; // 使用默认颜色
      }
    } else {
      // 只有在完全没有类型时才设置默认类型
      link.type = 'related'; // 默认为相关概念
      link.color = relationColorMap['related'];
    }
    
    // 确保标签设置，如果没有就使用type
    if (!link.label && link.type) {
      // 根据关系类型设置友好的标签
      const labelMap: Record<string, string> = {
        "prerequisite": "前置知识", 
        "contains": "包含关系",
        "references": "引用关系",
        "applies": "应用关系",
        "similar": "相似概念",
        "complements": "互补知识",
        "related": "相关概念", 
        "unrelated": "无关联"
      };
      
      link.label = labelMap[link.type] || link.type;
    }
  }
  
  // 输出统计信息
  console.log('连接类型统计:', typeCount);
  
  // 记录样本连接信息
  if (data.links.length > 0) {
    const sampleLink = data.links[0];
    console.log('样本连接:', {
      source: sampleLink.source,
      target: sampleLink.target,
      type: sampleLink.type,
      color: sampleLink.color,
      label: sampleLink.label
    });
  }
}