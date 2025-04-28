/**
 * 聚类缓存测试脚本
 * 用于验证聚类缓存写入功能
 */

import { db } from './server/db.js';
import { clusterMemoryRetrieval } from './server/services/learning/cluster_memory_retrieval.js';

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type] || colors.info, message);
}

/**
 * 检查聚类缓存表状态
 */
async function checkClusterCache() {
  try {
    // 检查表是否存在
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'cluster_result_cache'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      log('聚类缓存表不存在！', 'error');
      return;
    }
    
    log('聚类缓存表存在', 'success');
    
    // 获取缓存记录数量
    const countResult = await db.query('SELECT COUNT(*) FROM cluster_result_cache;');
    const count = parseInt(countResult.rows[0].count, 10);
    
    log(`聚类缓存表中有 ${count} 条记录`, count > 0 ? 'success' : 'warn');
    
    // 获取最近的缓存记录
    if (count > 0) {
      const recentCaches = await db.query(`
        SELECT user_id, cluster_count, vector_count, version, created_at, updated_at, expires_at
        FROM cluster_result_cache
        ORDER BY updated_at DESC
        LIMIT 5;
      `);
      
      log('最近的缓存记录：', 'info');
      recentCaches.rows.forEach(cache => {
        log(`- 用户ID: ${cache.user_id}, 聚类数: ${cache.cluster_count}, 向量数: ${cache.vector_count}, 版本: ${cache.version}, 更新时间: ${cache.updated_at}`, 'info');
      });
    }
    
  } catch (error) {
    log(`检查聚类缓存表出错: ${error}`, 'error');
  }
}

/**
 * 为指定用户生成聚类缓存
 */
async function generateClusterCache(userId) {
  try {
    log(`开始为用户 ${userId} 生成聚类缓存...`, 'info');
    
    // 强制刷新模式调用getUserClusters
    const clusterResult = await clusterMemoryRetrieval.getUserClusters(userId, true);
    
    if (clusterResult) {
      const topics = clusterResult.topics || [];
      const centroids = clusterResult.centroids || [];
      log(`成功生成聚类数据: ${topics.length || 0} 个主题, ${centroids.length || 0} 个中心点`, 'success');
    } else {
      log(`无法生成聚类数据，可能是用户记忆不足或向量嵌入缺失`, 'warn');
    }
    
    // 再次检查缓存表
    await checkClusterCache();
    
  } catch (error) {
    log(`为用户 ${userId} 生成聚类缓存时出错: ${error}`, 'error');
  }
}

/**
 * 清除指定用户的聚类缓存
 */
async function clearClusterCache(userId) {
  try {
    log(`清除用户 ${userId} 的聚类缓存...`, 'info');
    
    // 直接调用存储方法清除缓存
    await db.query('DELETE FROM cluster_result_cache WHERE user_id = $1', [userId]);
    
    log(`已清除用户 ${userId} 的聚类缓存`, 'success');
    
  } catch (error) {
    log(`清除用户 ${userId} 的聚类缓存时出错: ${error}`, 'error');
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 获取命令行参数
    const args = process.argv.slice(2);
    const userId = parseInt(args[0] || '6', 10); // 默认用户ID为6
    
    log(`=== 聚类缓存测试 (用户ID: ${userId}) ===`, 'info');
    
    // 检查当前缓存状态
    log('\n1. 检查当前缓存状态:', 'info');
    await checkClusterCache();
    
    // 先清除现有缓存
    log('\n2. 清除现有缓存:', 'info');
    await clearClusterCache(userId);
    
    // 生成新的缓存
    log('\n3. 生成新的缓存:', 'info');
    await generateClusterCache(userId);
    
    log('\n测试完成', 'success');
    
  } catch (error) {
    log(`测试过程中出错: ${error}`, 'error');
  } finally {
    // 关闭数据库连接
    await db.pool.end();
  }
}

// 执行主函数
main();