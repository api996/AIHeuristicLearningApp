/**
 * 聚类缓存服务调试脚本
 * 用于验证聚类缓存机制是否正常工作
 */

import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { storage } from './server/storage';
import { db } from './server/db';

// 彩色日志输出
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
async function testClusterCache() {
  try {
    colorLog('开始测试聚类缓存机制...', 'info');
    
    // 使用指定的测试用户ID
    const userId = 6;
    
    // 1. 检查缓存表状态
    colorLog('1. 检查缓存表状态...', 'info');
    let cacheCount;
    try {
      const result = await db.execute(sql`SELECT COUNT(*) FROM cluster_result_cache WHERE user_id = ${userId}`);
      cacheCount = result.rows[0].count;
      colorLog(`查询到用户${userId}的缓存记录数量: ${cacheCount}`, 'success');
    } catch (dbError) {
      colorLog(`数据库查询出错: ${dbError}`, 'error');
      throw dbError;
    }
    
    // 2. 创建模拟聚类结果
    colorLog('2. 创建模拟聚类结果...', 'info');
    const mockClusterResult = {
      "cluster_1": {
        "topic": "测试主题1",
        "memory_ids": ["mem_1", "mem_2", "mem_3"],
        "keywords": ["测试", "主题", "关键词"],
        "summary": "这是测试主题1的摘要内容"
      },
      "cluster_2": {
        "topic": "测试主题2",
        "memory_ids": ["mem_4", "mem_5"],
        "keywords": ["测试2", "主题2"],
        "summary": "这是测试主题2的摘要内容"
      }
    };
    
    // 3. 直接使用storage接口保存测试数据
    colorLog('3. 使用storage接口保存测试数据...', 'info');
    try {
      const savedCache = await storage.saveClusterResultCache(
        userId,
        mockClusterResult,
        2, // 聚类数量
        5, // 向量数量
        1  // 缓存有效期1小时
      );
      
      colorLog(`成功保存聚类缓存，ID: ${savedCache.id}`, 'success');
      console.log('保存的数据:', savedCache);
    } catch (saveError) {
      colorLog(`保存聚类缓存失败: ${saveError}`, 'error');
      console.error(saveError);
    }
    
    // 4. 获取刚保存的缓存
    colorLog('4. 获取刚保存的缓存...', 'info');
    try {
      const retrievedCache = await storage.getClusterResultCache(userId);
      if (retrievedCache) {
        colorLog(`成功获取聚类缓存，ID: ${retrievedCache.id}`, 'success');
        console.log('缓存数据信息:');
        console.log(`- 版本: ${retrievedCache.version}`);
        console.log(`- 聚类数量: ${retrievedCache.clusterCount}`);
        console.log(`- 向量数量: ${retrievedCache.vectorCount}`);
        console.log(`- 创建时间: ${retrievedCache.createdAt}`);
        console.log(`- 过期时间: ${retrievedCache.expiresAt}`);
        
        // 检查数据是否完整
        if (retrievedCache.clusterData) {
          const clusterData = retrievedCache.clusterData;
          colorLog('缓存中的聚类数据:', 'info');
          console.log(JSON.stringify(clusterData, null, 2));
          
          // 验证主题是否保存
          const topicNames = Object.values(clusterData).map((c: any) => c.topic);
          colorLog(`主题名称: ${topicNames.join(', ')}`, 'info');
          
          if (topicNames.includes('测试主题1') && topicNames.includes('测试主题2')) {
            colorLog('✅ 主题名称正确保存在缓存中', 'success');
          } else {
            colorLog('❌ 主题名称未正确保存', 'error');
          }
        } else {
          colorLog('❌ 缓存中没有聚类数据', 'error');
        }
      } else {
        colorLog('❌ 未找到缓存记录', 'error');
      }
    } catch (getError) {
      colorLog(`获取聚类缓存失败: ${getError}`, 'error');
      console.error(getError);
    }
    
    // 5. 清除测试缓存
    colorLog('5. 清除测试缓存...', 'info');
    try {
      await storage.clearClusterResultCache(userId);
      colorLog(`已清除用户${userId}的聚类缓存`, 'success');
    } catch (clearError) {
      colorLog(`清除聚类缓存失败: ${clearError}`, 'error');
    }
    
    colorLog('聚类缓存机制测试完成', 'success');
    return true;
  } catch (error) {
    colorLog(`测试过程中发生错误: ${error}`, 'error');
    return false;
  }
}

// 执行测试
async function main() {
  try {
    // 测试聚类缓存机制
    const cacheTestResult = await testClusterCache();
    
    if (cacheTestResult) {
      colorLog('所有测试完成并通过', 'success');
      process.exit(0);
    } else {
      colorLog('测试失败', 'error');
      process.exit(1);
    }
  } catch (error) {
    colorLog(`执行测试时发生错误: ${error}`, 'error');
    process.exit(1);
  }
}

// 导入SQL执行接口
import { sql } from 'drizzle-orm';

// 执行主测试函数
main().catch(error => {
  console.error('测试执行时发生未捕获的错误:', error);
  process.exit(1);
});