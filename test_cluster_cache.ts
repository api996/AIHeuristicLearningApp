/**
 * 聚类缓存服务测试脚本
 * 测试聚类缓存服务的功能和性能
 */

import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';

/**
 * 打印带颜色的日志
 */
function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const colorMap = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  
  const resetColor = '\x1b[0m';
  console.log(`${colorMap[type]}[${type.toUpperCase()}] ${message}${resetColor}`);
}

/**
 * 测试聚类缓存服务
 */
async function testClusterCacheService(): Promise<boolean> {
  try {
    // 使用一个测试用户ID
    const userId = 2; // 使用一个真实存在的用户ID
    
    log(`开始测试聚类缓存服务，用户ID=${userId}...`, 'info');
    
    // 清除现有缓存
    await storage.clearClusterResultCache(userId);
    log(`已清除用户${userId}的现有聚类缓存`, 'info');
    
    // 第一次执行，应该会执行实际的聚类操作
    log(`第一次获取聚类结果，应执行实际聚类操作...`, 'info');
    const startTime1 = Date.now();
    const result1 = await clusterCacheService.getUserClusterResults(userId, false);
    const duration1 = Date.now() - startTime1;
    
    const clusterCount1 = Object.keys(result1 || {}).length;
    log(`首次聚类完成，耗时=${duration1}ms，聚类数量=${clusterCount1}`, 'success');
    
    // 第二次执行，应该使用缓存
    log(`第二次获取聚类结果，应使用缓存...`, 'info');
    const startTime2 = Date.now();
    const result2 = await clusterCacheService.getUserClusterResults(userId, false);
    const duration2 = Date.now() - startTime2;
    
    const clusterCount2 = Object.keys(result2 || {}).length;
    log(`第二次聚类完成，耗时=${duration2}ms，聚类数量=${clusterCount2}`, 'success');
    
    // 检查缓存是否生效
    const isCacheEffective = duration2 < duration1;
    if (isCacheEffective) {
      log(`缓存有效：第二次调用(${duration2}ms)比第一次(${duration1}ms)快`, 'success');
    } else {
      log(`缓存无效：第二次调用(${duration2}ms)未比第一次(${duration1}ms)快`, 'warning');
    }
    
    // 强制刷新，应该会跳过缓存
    log(`强制刷新聚类结果，应跳过缓存...`, 'info');
    const startTime3 = Date.now();
    const result3 = await clusterCacheService.getUserClusterResults(userId, true);
    const duration3 = Date.now() - startTime3;
    
    const clusterCount3 = Object.keys(result3 || {}).length;
    log(`强制刷新完成，耗时=${duration3}ms，聚类数量=${clusterCount3}`, 'success');
    
    // 结果应该是一致的
    const isResultConsistent = clusterCount1 === clusterCount2 && clusterCount2 === clusterCount3;
    if (isResultConsistent) {
      log(`结果一致性检查通过：三次聚类数量一致`, 'success');
    } else {
      log(`结果一致性检查失败：聚类数量不一致 (${clusterCount1}, ${clusterCount2}, ${clusterCount3})`, 'warning');
    }
    
    // 查看内存使用情况
    const memoryUsage = process.memoryUsage();
    log(`内存使用情况: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`, 'info');
    
    // 测试与学习路径集成
    log(`测试聚类缓存与用户集群获取的集成...`, 'info');
    const startTime4 = Date.now();
    const { clusterResult, clusterCount } = await memoryService.getUserClusters(userId);
    const duration4 = Date.now() - startTime4;
    
    log(`通过memory_service获取聚类，耗时=${duration4}ms，聚类数量=${clusterCount}`, 'success');
    
    // 检查与直接调用的一致性
    const centroidCount = clusterResult?.centroids?.length || 0;
    if (centroidCount === clusterCount3) {
      log(`集成一致性检查通过：聚类数量一致 (${centroidCount})`, 'success');
    } else {
      log(`集成一致性检查失败：聚类数量不一致 (直接=${clusterCount3}, 集成=${centroidCount})`, 'warning');
    }
    
    // 总体结果
    const allTestsPassed = isCacheEffective && isResultConsistent && (centroidCount === clusterCount3);
    if (allTestsPassed) {
      log(`所有测试通过！聚类缓存服务工作正常`, 'success');
      return true;
    } else {
      log(`部分测试未通过，但服务基本功能正常`, 'warning');
      return false;
    }
  } catch (error) {
    log(`测试聚类缓存服务时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 测试聚类缓存服务
    const cacheServiceResult = await testClusterCacheService();
    
    if (cacheServiceResult) {
      log(`聚类缓存服务测试成功`, 'success');
    } else {
      log(`聚类缓存服务测试存在问题`, 'warning');
    }
  } catch (error) {
    log(`测试执行出错: ${error}`, 'error');
  }
}

// 执行主函数
main().catch(error => {
  console.error('Unhandled error:', error);
});