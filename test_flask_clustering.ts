/**
 * Flask聚类API测试脚本
 * 验证Flask API是否能正确启动并执行聚类
 */

// 使用require而不是import，避免TypeScript编译问题
const { startClusteringService, stopClusteringService, clusterVectors } = require('./server/services/learning/flask_clustering_service');

/**
 * 生成测试用的高维向量
 * @param count 向量数量
 * @param dimension 向量维度
 */
function generateTestVectors(count: number, dimension: number): {id: string, vector: number[]}[] {
  const vectors = [];
  
  for (let i = 0; i < count; i++) {
    const vector = Array.from({ length: dimension }, () => Math.random() - 0.5);
    vectors.push({
      id: `test_${Date.now()}_${i}`,
      vector: vector
    });
  }
  
  return vectors;
}

/**
 * 测试Flask聚类API
 */
async function testFlaskClustering() {
  console.log('=== 开始测试Flask聚类API ===');
  
  try {
    // 启动服务
    console.log('1. 启动Flask聚类API服务...');
    const serviceStarted = await startClusteringService();
    
    if (!serviceStarted) {
      console.error('❌ 服务启动失败，测试终止');
      return;
    }
    console.log('✅ Flask聚类API服务启动成功');
    
    // 生成测试数据
    console.log('2. 生成测试数据...');
    const testCount = 10;
    const testVectorDim = 3072;
    const testData = generateTestVectors(testCount, testVectorDim);
    console.log(`✅ 生成了${testCount}个${testVectorDim}维测试向量`);
    
    // 提取向量数据
    const memoryIds = testData.map(item => item.id);
    const vectors = testData.map(item => item.vector);
    
    // 发送聚类请求
    console.log('3. 发送聚类请求...');
    const result = await clusterVectors(memoryIds, vectors);
    
    // 验证结果
    if (result && result.centroids && result.centroids.length > 0) {
      console.log(`✅ 聚类成功，生成了${result.centroids.length}个聚类`);
      
      // 打印详细信息
      result.centroids.forEach((cluster, index) => {
        console.log(`   聚类 #${index+1}: ${cluster.points.length} 个样本`);
      });
      
      console.log('=== 测试结果: 成功 ===');
    } else {
      console.error('❌ 聚类失败，没有生成有效的聚类结果');
      console.log('=== 测试结果: 失败 ===');
    }
  } catch (error) {
    console.error(`❌ 测试过程中出错: ${error}`);
    console.log('=== 测试结果: 错误 ===');
  } finally {
    // 停止服务
    console.log('4. 停止Flask聚类API服务...');
    await stopClusteringService();
    console.log('✅ Flask聚类API服务已停止');
  }
}

// 立即执行测试
testFlaskClustering().catch(err => {
  console.error('测试脚本执行失败:', err);
});