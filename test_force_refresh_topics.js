/**
 * 强制刷新聚类主题测试脚本
 * 用于测试强制刷新Gemini主题生成功能
 */

// 使用ESM导入
import { clusterCacheService } from './server/services/learning/cluster_cache_service.js';
import { storage } from './server/storage.js';

/**
 * 打印带颜色的日志
 * @param {string} message 
 * @param {string} type 
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m' // 红色
  };
  
  const reset = '\x1b[0m';
  console.log(`${colors[type] || colors.info}[${type.toUpperCase()}] ${message}${reset}`);
}

/**
 * 强制刷新用户的聚类主题
 * @param {number} userId 用户ID
 */
async function forceRefreshTopics(userId) {
  try {
    log(`开始强制刷新用户${userId}的聚类主题...`);
    
    // 清除旧缓存
    await storage.clearClusterResultCache(userId);
    log(`已清除用户${userId}的现有聚类缓存`, 'success');
    
    // 强制重新生成聚类结果和主题
    const result = await clusterCacheService.getUserClusterResults(userId, true);
    
    // 检查结果
    const clusterCount = Object.keys(result || {}).length;
    log(`强制刷新完成，聚类数量: ${clusterCount}`, 'success');
    
    if (clusterCount > 0) {
      log(`聚类主题与详细信息:`);
      
      // 打印完整的聚类结果数据结构
      log(`完整聚类结果结构:`, 'info');
      console.dir(result, { depth: 5, colors: true });
      
      for (const [clusterId, clusterData] of Object.entries(result)) {
        // 打印内存IDs
        const memoryIds = clusterData.memory_ids || [];
        log(`  - 聚类${clusterId}: "${clusterData.topic || '无主题'}" (${memoryIds.length}条记忆)`, 'info');
        
        // 打印记忆列表
        if (memoryIds.length > 0) {
          log(`    记忆ID列表: ${memoryIds.slice(0, 3).join(', ')}${memoryIds.length > 3 ? '...' : ''}`, 'info');
        }
        
        // 打印该聚类的关键词
        if (clusterData.keywords && clusterData.keywords.length > 0) {
          log(`    关键词: ${clusterData.keywords.join(', ')}`, 'info');
        }
        
        // 打印其他可能的属性
        if (clusterData.summary) {
          log(`    摘要: ${clusterData.summary}`, 'info');
        }
      }
    } else {
      log(`未找到聚类数据`, 'warn');
    }
    
    log('测试完成!', 'success');
  } catch (error) {
    log(`测试出错: ${error}`, 'error');
  }
}

/**
 * 主函数
 */
async function main() {
  // 使用ID=15的用户
  const userId = 15;
  await forceRefreshTopics(userId);
}

// 执行主函数
main();