/**
 * 测试聚类主题生成脚本
 * 直接测试完整的聚类和主题生成流程
 */

import { log } from './server/utils';

/**
 * 主测试函数
 */
async function testClusteringWithTopics() {
  try {
    log('开始测试聚类主题生成', 'info');
    
    // 导入聚类缓存服务
    const { clusterCacheService } = await import('./server/services/learning/cluster_cache_service');
    
    // 强制刷新用户6的聚类结果，以测试主题生成
    log('强制刷新用户6的聚类结果...', 'info');
    const clusterResult = await clusterCacheService.getUserClusterResults(6, true);
    
    // 读取主题
    log('聚类结果:', 'success');
    
    // 遍历聚类，输出主题
    if (clusterResult && typeof clusterResult === 'object') {
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        // @ts-ignore
        const clusterData = cluster as any;
        log(`聚类 ${clusterId}: 主题 = "${clusterData.topic || '未生成'}", 包含 ${clusterData.memory_ids?.length || 0} 条记忆`, 'info');
      }
    }
    
    log('测试完成！', 'success');
  } catch (error) {
    log(`测试失败: ${error}`, 'error');
  }
}

// 执行测试
testClusteringWithTopics();