/**
 * 主题图谱预加载器 - 重定向版
 * 将所有调用重定向到统一图谱预加载器
 * 这个文件只是为了向后兼容性，保留API接口，但实际使用统一图谱加载器
 */
import { 
  preloadGraphData, 
  getGraphData, 
  clearGraphCache,
  type GraphNode,
  type GraphLink,
  type GraphData
} from './unified-graph-preloader';

// 定义的类型只是为了兼容性
export interface TopicGraphNode extends GraphNode {}
export interface TopicGraphLink extends GraphLink {}
export interface TopicGraphData extends GraphData {}

/**
 * 预加载主题图谱数据 - 重定向到统一图谱加载器
 * @param userId 用户ID
 * @param forceRefresh 是否强制刷新缓存
 * @returns 承诺主题图谱数据
 */
export async function preloadTopicGraphData(userId: number, forceRefresh: boolean = false): Promise<TopicGraphData> {
  console.log("[重定向] 主题图谱请求 -> 统一图谱加载器");
  return preloadGraphData(userId, 'topic', forceRefresh);
}

/**
 * 获取已缓存的主题图谱数据 - 重定向到统一图谱加载器
 * @param userId 用户ID
 * @returns 承诺主题图谱数据
 */
export async function getTopicGraphData(userId: number): Promise<TopicGraphData> {
  console.log("[重定向] 获取主题图谱 -> 统一图谱加载器");
  return getGraphData(userId, 'topic');
}

/**
 * 清除缓存的主题图谱数据 - 重定向到统一图谱加载器
 * @param userId 用户ID，不提供则清除所有用户的缓存
 */
export function clearTopicGraphCache(userId?: number): void {
  console.log("[重定向] 清除主题图谱缓存 -> 统一图谱加载器");
  clearGraphCache(userId, 'topic');
}

// 这些函数已经不再直接使用，而是通过统一图谱加载器间接调用
// 保留这些导出函数仅是为了向后兼容，防止现有代码出错
export const fetchTopicGraphData = async (userId: number): Promise<TopicGraphData> => {
  console.warn("警告: 直接调用fetchTopicGraphData已被废弃，请使用preloadTopicGraphData");
  return preloadTopicGraphData(userId);
};

export const fetchTopicGraphDataForceRefresh = async (userId: number): Promise<TopicGraphData> => {
  console.warn("警告: 直接调用fetchTopicGraphDataForceRefresh已被废弃，请使用preloadTopicGraphData(userId, true)");
  return preloadTopicGraphData(userId, true);
};