/**
 * Python聚类服务测试脚本 (TypeScript版本)
 * 用于验证Python脚本直接调用能否正常工作
 */

import { directPythonService, VectorData } from './server/services/learning/direct_python_service';
import { ClusterResult } from './server/services/learning/cluster_types';

async function testPythonClustering(): Promise<boolean> {
  console.log('开始测试Python聚类服务...');
  
  try {
    // 创建测试向量数据
    const testVectors: VectorData[] = [];
    // 生成5个不同组的向量，每组2个相似向量
    for (let group = 0; group < 5; group++) {
      for (let i = 0; i < 2; i++) {
        const base = group * 10;
        const vector = Array(20).fill(0).map((_, idx) => {
          if (idx >= base && idx < base + 5) {
            return 0.8 + Math.random() * 0.2;
          }
          return Math.random() * 0.2;
        });
        
        testVectors.push({
          id: `test_${group}_${i}`,
          vector
        });
      }
    }
    
    console.log(`生成了 ${testVectors.length} 个测试向量`);
    
    // 调用聚类服务
    console.log('调用Python聚类服务...');
    const result = await directPythonService.clusterVectors(testVectors);
    
    // 检查结果
    console.log('聚类结果:', JSON.stringify(result, null, 2));
    
    if (result && result.centroids && result.centroids.length > 0) {
      console.log(`✅ 测试成功: Python聚类服务返回了 ${result.centroids.length} 个聚类中心`);
      return true;
    } else {
      console.log('❌ 测试失败: Python聚类服务没有返回有效的聚类结果');
      return false;
    }
  } catch (error) {
    console.error('❌ 测试失败，发生错误:', error);
    return false;
  }
}

// 执行测试
testPythonClustering().then(success => {
  if (success) {
    console.log('Python聚类服务测试通过 ✅');
    process.exit(0);
  } else {
    console.log('Python聚类服务测试失败 ❌');
    process.exit(1);
  }
}).catch(error => {
  console.error('测试执行错误:', error);
  process.exit(1);
});