/**
 * 强制刷新所有缓存：
 * 1. 知识图谱缓存
 * 2. 聚类分析缓存
 * 
 * 此脚本用于问题排查，强制刷新系统中的所有缓存数据，
 * 确保下一次请求使用的是最新生成的数据。
 */

import { db } from '../server/db.js';
import { storage } from '../server/storage.js';
import { log } from '../server/utils.js';

/**
 * 强制清除所有缓存
 */
async function clearAllCaches() {
  try {
    log('开始清除所有缓存...');
    
    // 清除数据库中的知识图谱缓存
    const knowledgeGraphCachesResult = await db.execute(
      `SELECT user_id FROM knowledge_graph_cache`
    );
    
    const knowledgeGraphUserIds = knowledgeGraphCachesResult.rows.map(row => row.user_id);
    log(`发现 ${knowledgeGraphUserIds.length} 个知识图谱缓存条目`);
    
    for (const userId of knowledgeGraphUserIds) {
      log(`清除用户 ${userId} 的知识图谱缓存...`);
      await storage.clearKnowledgeGraphCache(userId);
    }
    
    // 清除数据库中的聚类缓存
    const clusterCachesResult = await db.execute(
      `SELECT user_id FROM cluster_result_cache`
    );
    
    const clusterUserIds = clusterCachesResult.rows.map(row => row.user_id);
    log(`发现 ${clusterUserIds.length} 个聚类缓存条目`);
    
    for (const userId of clusterUserIds) {
      log(`清除用户 ${userId} 的聚类缓存...`);
      await storage.clearClusterResultCache(userId);
    }
    
    // 直接执行SQL删除所有缓存表中的数据，以防有残留
    log('执行SQL清除所有缓存表数据...');
    await db.execute('DELETE FROM knowledge_graph_cache');
    await db.execute('DELETE FROM cluster_result_cache');
    
    // 设置所有缓存过期
    log('修改所有缓存过期时间为过去时间...');
    await db.execute(`
      UPDATE knowledge_graph_cache 
      SET expires_at = NOW() - INTERVAL '1 day'
      WHERE expires_at > NOW()
    `);
    
    await db.execute(`
      UPDATE cluster_result_cache 
      SET expires_at = NOW() - INTERVAL '1 day'
      WHERE expires_at > NOW()
    `);
    
    log('所有缓存已清除成功!');
  } catch (error) {
    log(`清除缓存失败: ${error}`);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始强制刷新所有缓存...');
    await clearAllCaches();
    log('所有缓存已成功清除，系统将在下一次请求时生成新数据。');
    process.exit(0);
  } catch (error) {
    log(`执行失败: ${error}`);
    process.exit(1);
  }
}

// 执行主函数
main();