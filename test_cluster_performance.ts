/**
 * 集群缓存性能测试脚本
 * 专注测试缓存机制在有效和失效情况下的性能差异
 */

import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { memoryService } from './server/services/learning/memory_service';
import fs from 'fs';
import path from 'path';

// 使用现有用户ID
const TEST_USER_ID = 15; // testuser

/**
 * 保存结果到文件
 */
function saveToFile(data: any, filename: string): void {
  try {
    const resultsDir = path.join(process.cwd(), 'tmp');
    
    // 确保目录存在
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const filePath = path.join(resultsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`结果已保存到: ${filePath}`);
  } catch (error) {
    console.error(`保存结果时出错: ${error}`);
  }
}

/**
 * 与memory_service集成测试
 */
async function testMemoryServiceIntegration(): Promise<any> {
  try {
    console.log(`测试memory_service的聚类性能和缓存效果...`);
    
    const results = {
      withoutCache: {
        startTime: 0,
        endTime: 0,
        duration: 0,
        clusterCount: 0
      },
      withCache: {
        startTime: 0,
        endTime: 0,
        duration: 0,
        clusterCount: 0
      }
    };
    
    // 第一次调用，不使用缓存 (forceRefresh=true)
    results.withoutCache.startTime = Date.now();
    const resultNoCache = await memoryService.getUserClusters(TEST_USER_ID, true);
    results.withoutCache.endTime = Date.now();
    results.withoutCache.duration = results.withoutCache.endTime - results.withoutCache.startTime;
    results.withoutCache.clusterCount = resultNoCache.clusterCount;
    
    console.log(`不使用缓存: 耗时=${results.withoutCache.duration}ms，聚类数量=${resultNoCache.clusterCount}`);
    
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 第二次调用，使用缓存 (forceRefresh=false)
    results.withCache.startTime = Date.now();
    const resultWithCache = await memoryService.getUserClusters(TEST_USER_ID, false);
    results.withCache.endTime = Date.now();
    results.withCache.duration = results.withCache.endTime - results.withCache.startTime;
    results.withCache.clusterCount = resultWithCache.clusterCount;
    
    console.log(`使用缓存: 耗时=${results.withCache.duration}ms，聚类数量=${resultWithCache.clusterCount}`);
    
    // 性能改进
    const improvementFactor = results.withoutCache.duration / results.withCache.duration;
    console.log(`缓存性能提升: ${improvementFactor.toFixed(2)}倍 (${results.withoutCache.duration}ms → ${results.withCache.duration}ms)`);
    
    // 完整结果
    const fullResult = {
      userId: TEST_USER_ID,
      timestamp: new Date().toISOString(),
      improvementFactor,
      ...results
    };
    
    return fullResult;
  } catch (error) {
    console.error(`测试出错: ${error}`);
    return { error: String(error) };
  }
}

/**
 * 测试直接调用缓存服务
 */
async function testDirectCacheService(): Promise<any> {
  try {
    console.log(`测试聚类缓存服务的性能...`);
    
    const results = {
      firstCall: {
        startTime: 0,
        endTime: 0,
        duration: 0,
        clusterCount: 0
      },
      secondCall: {
        startTime: 0,
        endTime: 0, 
        duration: 0,
        clusterCount: 0
      }
    };
    
    // 第一次调用
    results.firstCall.startTime = Date.now();
    const result1 = await clusterCacheService.getUserClusterResults(TEST_USER_ID, false);
    results.firstCall.endTime = Date.now();
    results.firstCall.duration = results.firstCall.endTime - results.firstCall.startTime;
    results.firstCall.clusterCount = Object.keys(result1 || {}).length;
    
    console.log(`第一次调用: 耗时=${results.firstCall.duration}ms，聚类数量=${results.firstCall.clusterCount}`);
    
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 第二次调用
    results.secondCall.startTime = Date.now();
    const result2 = await clusterCacheService.getUserClusterResults(TEST_USER_ID, false);
    results.secondCall.endTime = Date.now();
    results.secondCall.duration = results.secondCall.endTime - results.secondCall.startTime;
    results.secondCall.clusterCount = Object.keys(result2 || {}).length;
    
    console.log(`第二次调用: 耗时=${results.secondCall.duration}ms，聚类数量=${results.secondCall.clusterCount}`);
    
    // 性能改进
    const improvementFactor = results.firstCall.duration / results.secondCall.duration;
    console.log(`缓存性能提升: ${improvementFactor.toFixed(2)}倍 (${results.firstCall.duration}ms → ${results.secondCall.duration}ms)`);
    
    // 检查返回的聚类详情
    const clusters = [];
    if (results.secondCall.clusterCount > 0) {
      for (const [clusterId, cluster] of Object.entries(result2)) {
        const clusterData = cluster as any;
        clusters.push({
          id: clusterId,
          topic: clusterData.topic || '无主题',
          memoryCount: clusterData.memory_ids?.length || 0,
          keywords: clusterData.keywords || []
        });
      }
    }
    
    // 完整结果
    const fullResult = {
      userId: TEST_USER_ID,
      timestamp: new Date().toISOString(),
      improvementFactor,
      clusters,
      ...results
    };
    
    return fullResult;
  } catch (error) {
    console.error(`测试出错: ${error}`);
    return { error: String(error) };
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 测试1: memory_service集成
    const msResult = await testMemoryServiceIntegration();
    saveToFile(msResult, 'memory_service_integration_test.json');
    
    // 测试2: 直接使用缓存服务
    const cacheResult = await testDirectCacheService();
    saveToFile(cacheResult, 'direct_cache_service_test.json');
    
    console.log('所有测试完成');
  } catch (error) {
    console.error(`主函数出错: ${error}`);
  }
}

// 执行测试
main().catch(console.error);