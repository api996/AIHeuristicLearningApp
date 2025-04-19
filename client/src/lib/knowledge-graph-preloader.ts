/**
 * 知识图谱数据预加载器
 * 用于缓存和预加载知识图谱数据，提高渲染性能
 */

interface KnowledgeNode {
  id: string;
  label: string;
  size: number;
  category?: string;
  clusterId?: string;
  color?: string;
}

interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
  type?: string;
}

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  version?: number;
}

// 内存缓存
const graphCache: Record<number, KnowledgeGraph> = {};

/**
 * 预加载并缓存知识图谱数据
 * @param userId 用户ID
 * @returns 知识图谱数据
 */
export async function preloadKnowledgeGraphData(userId: number): Promise<KnowledgeGraph> {
  if (graphCache[userId]) {
    console.log('预加载知识图谱数据...');
    console.log('从预加载缓存获取知识图谱数据...');
    return graphCache[userId];
  }

  console.log('预加载知识图谱数据...');
  try {
    const response = await fetch(`/api/learning-path/${userId}/knowledge-graph`);
    
    if (!response.ok) {
      throw new Error(`获取知识图谱数据失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.nodes || !Array.isArray(data.nodes)) {
      throw new Error('无效的知识图谱数据');
    }
    
    // 缓存数据
    graphCache[userId] = data;
    
    console.log(`预加载知识图谱数据成功:`, data.nodes.length, '个节点,', data.links.length, '个连接');
    console.log('节点示例:', data.nodes[0]);
    console.log('连接示例:', data.links[0]);
    
    return data;
  } catch (error) {
    console.error('预加载知识图谱数据失败:', error);
    // 创建一个空的图谱数据作为默认值
    return { nodes: [], links: [] };
  }
}

/**
 * 获取知识图谱数据（优先从缓存获取）
 * @param userId 用户ID
 * @returns 知识图谱数据
 */
export async function getKnowledgeGraphData(userId: number): Promise<KnowledgeGraph> {
  // 如果缓存中有数据，直接返回
  if (graphCache[userId]) {
    return graphCache[userId];
  }
  
  // 否则预加载并返回
  return await preloadKnowledgeGraphData(userId);
}

/**
 * 清除知识图谱缓存
 * @param userId 用户ID
 */
export function clearKnowledgeGraphCache(userId: number): void {
  if (graphCache[userId]) {
    delete graphCache[userId];
    console.log(`已清除用户${userId}的知识图谱缓存`);
  }
}