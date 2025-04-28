/**
 * 聚类缓存服务调试脚本
 * 用于验证聚类缓存机制是否正常工作
 */

import { db, sql } from './server/db';
import { storage } from './server/storage';
import { clusterMemoryRetrieval } from './server/services/learning/cluster_memory_retrieval';

function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  console.log(colors[type], message);
}

/**
 * 测试聚类缓存机制
 */
async function testClusterCache(): Promise<void> {
  try {
    colorLog('开始测试聚类缓存机制...', 'info');
    
    // 使用指定的测试用户ID
    const userId = 6;
    
    // 1. 检查缓存表状态
    colorLog('1. 检查缓存表状态...', 'info');
    try {
      const result = await db.execute(sql`SELECT COUNT(*) FROM cluster_result_cache WHERE user_id = ${userId}`);
      const cacheCount = parseInt(result.rows[0].count, 10);
      colorLog(`查询到用户${userId}的缓存记录数量: ${cacheCount}`, 'success');
      
      if (cacheCount > 0) {
        // 获取现有缓存信息
        const existingCache = await db.execute(sql`
          SELECT id, user_id, cluster_count, vector_count, version, created_at, updated_at, expires_at 
          FROM cluster_result_cache 
          WHERE user_id = ${userId}
        `);
        
        if (existingCache.rows.length > 0) {
          const cache = existingCache.rows[0];
          colorLog('现有缓存信息:', 'info');
          console.log(cache);
        }
      }
    } catch (dbError) {
      colorLog(`数据库查询出错: ${dbError}`, 'error');
    }
    
    // 2. 清除现有缓存
    colorLog('2. 清除现有缓存...', 'info');
    try {
      await db.execute(sql`DELETE FROM cluster_result_cache WHERE user_id = ${userId}`);
      colorLog(`已清除用户 ${userId} 的聚类缓存`, 'success');
    } catch (deleteError) {
      colorLog(`清除缓存出错: ${deleteError}`, 'error');
    }
    
    // 3. 主动触发聚类缓存生成
    colorLog('3. 主动触发聚类缓存生成...', 'info');
    try {
      // 使用force=true参数强制刷新聚类缓存
      const clusterResult = await clusterMemoryRetrieval.getUserClusters(userId, true);
      
      if (clusterResult) {
        colorLog(`聚类生成成功，包含 ${clusterResult.topics?.length || 0} 个主题`, 'success');
        
        // 打印部分主题信息
        if (clusterResult.topics && clusterResult.topics.length > 0) {
          colorLog('示例主题:', 'info');
          console.log(clusterResult.topics[0]);
        }
      } else {
        colorLog('聚类生成失败，返回null', 'error');
      }
    } catch (clusterError) {
      colorLog(`聚类缓存生成出错: ${clusterError}`, 'error');
    }
    
    // 4. 验证缓存是否成功保存
    colorLog('4. 验证缓存是否成功保存...', 'info');
    try {
      const verifyResult = await db.execute(sql`
        SELECT id, user_id, cluster_count, vector_count, version, created_at, updated_at, expires_at 
        FROM cluster_result_cache 
        WHERE user_id = ${userId}
      `);
      
      if (verifyResult.rows.length > 0) {
        const cache = verifyResult.rows[0];
        colorLog(`缓存验证成功，ID: ${cache.id}, 聚类数: ${cache.cluster_count}, 向量数: ${cache.vector_count}`, 'success');
      } else {
        colorLog('验证失败，未找到缓存记录', 'error');
      }
    } catch (verifyError) {
      colorLog(`验证缓存时出错: ${verifyError}`, 'error');
    }
    
    // 5. 测试缓存获取
    colorLog('5. 测试从存储层获取缓存...', 'info');
    try {
      // 使用storage接口获取缓存
      const retrievedCache = await storage.getClusterResultCache(userId);
      
      if (retrievedCache) {
        colorLog(`成功获取聚类缓存: ${retrievedCache.id}`, 'success');
        colorLog(`缓存信息: 版本=${retrievedCache.version}, 聚类数=${retrievedCache.clusterCount}, 向量数=${retrievedCache.vectorCount}`, 'info');
        
        // 验证数据结构
        if (retrievedCache.clusterData) {
          colorLog('缓存数据结构验证:', 'info');
          const hasCentroids = retrievedCache.clusterData.centroids && Array.isArray(retrievedCache.clusterData.centroids);
          const hasTopics = retrievedCache.clusterData.topics && Array.isArray(retrievedCache.clusterData.topics);
          
          colorLog(`- centroids: ${hasCentroids ? '存在' : '缺失'}`, hasCentroids ? 'success' : 'warn');
          colorLog(`- topics: ${hasTopics ? '存在' : '缺失'}`, hasTopics ? 'success' : 'warn');
          
          // 数据类型一致性检查
          if (hasTopics) {
            const topicsLength = retrievedCache.clusterData.topics.length;
            colorLog(`- topics数量: ${topicsLength}`, 'info');
            
            if (topicsLength > 0) {
              const firstTopic = retrievedCache.clusterData.topics[0];
              colorLog(`- 第一个主题: ${JSON.stringify(firstTopic)}`, 'info');
            }
          }
        } else {
          colorLog('缓存中缺少clusterData字段', 'error');
        }
      } else {
        colorLog('未找到任何缓存记录', 'warn');
      }
    } catch (retrieveError) {
      colorLog(`获取缓存时出错: ${retrieveError}`, 'error');
    }
    
    colorLog('聚类缓存测试完成', 'success');
    
  } catch (error) {
    colorLog(`测试过程中出现未捕获的错误: ${error}`, 'error');
  }
}

async function main(): Promise<void> {
  try {
    await testClusterCache();
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    // Drizzle ORM with Neon doesn't need explicit connection closing
    console.log('测试结束');
  }
}

// 执行主函数
main();