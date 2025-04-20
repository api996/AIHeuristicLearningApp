/**
 * Python聚类服务测试脚本
 * 用于测试Python实现的高维向量聚类功能
 */

import { pythonClusteringService } from "./server/services/learning/python_clustering";

// 测试开始时间
const startTime = Date.now();

// 在控制台输出彩色日志
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    error: '\x1b[31m', // 红色
    warn: '\x1b[33m', // 黄色
    reset: '\x1b[0m' // 重置
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

// 生成随机高维向量 (用于模拟测试)
function generateMockVectors(count: number, dimension: number = 3072): { id: string; vector: number[] }[] {
  log(`生成${count}个${dimension}维测试向量...`);
  const vectors = [];
  
  for (let i = 0; i < count; i++) {
    const vector = Array.from({ length: dimension }, () => Math.random() - 0.5);
    vectors.push({
      id: `test_${i}`,
      vector: vector
    });
  }
  
  return vectors;
}

/**
 * 执行Python聚类测试
 */
async function testPythonClustering() {
  log('开始测试Python聚类服务...', 'info');
  
  try {
    // 生成测试数据
    const genStart = Date.now();
    const testVectors = generateMockVectors(20, 3072);
    log(`已生成${testVectors.length}个${testVectors[0].vector.length}维测试向量`);
    log(`生成测试数据: ${Date.now() - genStart}ms`);
    
    // 调用Python聚类服务
    log('调用Python聚类服务...');
    const clusterStart = Date.now();
    const clusterResult = await pythonClusteringService.clusterVectors(testVectors);
    
    // 验证结果
    if (clusterResult.centroids.length > 0) {
      log(`聚类成功: 识别出${clusterResult.centroids.length}个聚类，迭代次数: ${clusterResult.iterations}`, 'success');
      log(`聚类处理耗时: ${Date.now() - clusterStart}ms`);
      log(`聚类中心示例: ${JSON.stringify(clusterResult.centroids[0].vector.slice(0, 5))}...`);
      return true;
    } else {
      log('聚类结果无效: 未返回有效的聚类中心', 'error');
      return false;
    }
  } catch (error) {
    log(`测试过程出错: ${error}`, 'error');
    return false;
  }
}

// 执行测试
testPythonClustering().then((success) => {
  log(`总耗时: ${Date.now() - startTime}ms`);
  process.exit(success ? 0 : 1);
});