/**
 * Python聚类服务测试脚本
 * 用于测试Python实现的高维向量聚类功能
 */

import { pythonClusteringService } from './server/services/learning/python_clustering';

// 模拟3072维向量数据
function generateMockVectors(count: number, dimension: number = 3072): { id: string; vector: number[] }[] {
  const vectors: { id: string; vector: number[] }[] = [];
  
  // 创建3个不同的中心向量（模拟聚类中心）
  const centers = [
    Array(dimension).fill(0).map(() => Math.random() * 0.1),         // 靠近原点的向量组
    Array(dimension).fill(0).map(() => 0.5 + Math.random() * 0.1),   // 中等位置的向量组
    Array(dimension).fill(0).map(() => 0.9 + Math.random() * 0.1)    // 接近1的向量组
  ];
  
  // 围绕中心点生成向量
  for (let i = 0; i < count; i++) {
    // 每个向量从三个中心之一派生出来
    const centerIndex = i % centers.length;
    const center = centers[centerIndex];
    
    // 生成以中心为基准的随机向量（添加少量噪声）
    const vector = center.map(value => {
      const noise = (Math.random() - 0.5) * 0.05; // 小噪声
      return Math.max(0, Math.min(1, value + noise)); // 确保值在0-1之间
    });
    
    vectors.push({
      id: `test_${i}`,
      vector
    });
  }
  
  return vectors;
}

/**
 * 执行Python聚类测试
 */
async function testPythonClustering() {
  console.log('开始测试Python聚类服务...');
  console.time('生成测试数据');
  
  // 1. 生成测试数据
  const testVectors = generateMockVectors(20); // 20个3072维向量
  console.log(`已生成${testVectors.length}个${testVectors[0].vector.length}维测试向量`);
  console.timeEnd('生成测试数据');
  
  console.time('Python聚类处理');
  // 2. 调用Python聚类服务
  try {
    console.log('调用Python聚类服务...');
    const clusterResult = await pythonClusteringService.clusterVectors(testVectors);
    
    // 3. 验证结果
    if (!clusterResult || !clusterResult.centroids || clusterResult.centroids.length === 0) {
      console.error('聚类结果无效: 未返回有效的聚类中心');
      return;
    }
    
    console.log('Python聚类结果:');
    console.log(`- 聚类数量: ${clusterResult.centroids.length}`);
    console.log(`- 迭代次数: ${clusterResult.iterations}`);
    
    // 打印每个聚类的详细信息
    clusterResult.centroids.forEach(centroid => {
      console.log(`\n聚类 #${centroid.id}:`);
      console.log(`- 包含点数: ${centroid.points.length}`);
      console.log(`- 中心向量 (前5个元素): [${centroid.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      
      // 打印前3个点
      if (centroid.points.length > 0) {
        console.log('- 包含的点:');
        centroid.points.slice(0, 3).forEach(point => {
          console.log(`  - 点ID: ${point.id}`);
        });
        
        if (centroid.points.length > 3) {
          console.log(`  - ... 以及其他 ${centroid.points.length - 3} 个点`);
        }
      }
    });
    
    console.log('\n聚类验证:');
    // 检查每个点是否都被分配到某个聚类
    const unassignedPoints = clusterResult.points.filter(point => point.clusterId === -1);
    console.log(`- 未分配聚类的点: ${unassignedPoints.length}`);
    
    // 验证每个聚类内的点数之和等于总点数
    const totalAssignedPoints = clusterResult.centroids.reduce(
      (sum, centroid) => sum + centroid.points.length, 0
    );
    console.log(`- 分配到聚类中的总点数: ${totalAssignedPoints}`);
    console.log(`- 原始数据点总数: ${testVectors.length}`);
    
    if (totalAssignedPoints === testVectors.length && unassignedPoints.length === 0) {
      console.log('\n✅ 验证通过: 所有点都被正确分配到聚类中');
    } else {
      console.log('\n❌ 验证失败: 点分配数量不匹配');
    }
    
    console.timeEnd('Python聚类处理');
    
  } catch (error) {
    console.error('测试过程出错:', error);
  }
}

// 执行测试
testPythonClustering().catch(console.error);