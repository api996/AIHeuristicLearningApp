/**
 * Python直接聚类服务测试脚本
 * 用于验证Python聚类服务是否正常工作，并显示转换过程
 */

import { directPythonService, VectorData } from './server/services/learning/direct_python_service';
import { ClusterResult } from './server/services/learning/cluster_types';

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
 * 生成测试用的高维向量
 * @param count 向量数量
 * @param dimension 向量维度
 */
function generateTestVectors(count: number, dimension: number): {id: string, vector: number[]}[] {
  const vectors: {id: string, vector: number[]}[] = [];
  
  // 创建5个不同的聚类中心
  const clusterCenters = Array(5).fill(0).map(() => {
    return Array(dimension).fill(0).map(() => Math.random() * 2 - 1);
  });
  
  // 围绕聚类中心生成向量
  for (let i = 0; i < count; i++) {
    // 选择一个聚类中心
    const centerIndex = i % clusterCenters.length;
    const center = clusterCenters[centerIndex];
    
    // 围绕中心添加一些随机噪声
    const vector = center.map(v => v + (Math.random() * 0.2 - 0.1));
    
    vectors.push({
      id: `mem_${i}`,
      vector
    });
  }
  
  return vectors;
}

/**
 * 转换聚类结果为预期格式
 */
function transformClusterResult(result: ClusterResult): any {
  try {
    if (!result || !result.centroids || result.centroids.length === 0) {
      colorLog("聚类结果为空或无效", "warn");
      return {};
    }
    
    const transformedResult: any = {};
    
    // 遍历所有聚类中心
    result.centroids.forEach((centroid, index) => {
      // 提取属于该聚类的记忆ID
      const memoryIds = centroid.points.map(p => p.id);
      
      // 创建聚类对象
      transformedResult[`cluster_${index}`] = {
        centroid: centroid.center,  // 保存中心向量
        memory_ids: memoryIds,      // 保存记忆ID列表
        topic: "",                  // 主题为空，等待后续生成
        cluster_id: `cluster_${index}`
      };
    });
    
    return transformedResult;
  } catch (error) {
    colorLog(`转换聚类结果出错: ${error}`, "error");
    return {};
  }
}

/**
 * 测试Python聚类服务
 */
async function testPythonClustering(): Promise<boolean> {
  try {
    colorLog("开始测试Python直接聚类服务...", "info");
    
    // 生成测试向量 - 使用与系统相同的向量维度
    const dimension = 3072;
    const vectors = generateTestVectors(30, dimension);
    
    colorLog(`生成了${vectors.length}个测试向量，维度${dimension}`, "info");
    colorLog(`向量示例: id=${vectors[0].id}, 维度=${vectors[0].vector.length}`, "info");
    
    // 调用Python聚类服务
    colorLog("调用Python聚类服务...", "info");
    const rawResult = await directPythonService.clusterVectors(vectors);
    
    // 输出原始结果
    colorLog("Python聚类服务返回的原始结果:", "info");
    console.log("centroids数量:", rawResult.centroids.length);
    if (rawResult.centroids.length > 0) {
      console.log("第一个centroid示例:");
      console.log("- 中心点维度:", rawResult.centroids[0].center.length);
      console.log("- 包含的点数量:", rawResult.centroids[0].points.length);
      if (rawResult.centroids[0].points.length > 0) {
        console.log("- 第一个点ID:", rawResult.centroids[0].points[0].id);
      }
    }
    
    // 将原始结果转换为应用期望的格式
    colorLog("转换为应用期望的格式...", "info");
    const transformedResult = transformClusterResult(rawResult);
    
    // 输出转换后的结果
    colorLog("转换后的结果:", "info");
    console.log("聚类数量:", Object.keys(transformedResult).length);
    if (Object.keys(transformedResult).length > 0) {
      const firstCluster = transformedResult[Object.keys(transformedResult)[0]];
      console.log("第一个聚类示例:");
      console.log("- 中心点维度:", firstCluster.centroid.length);
      console.log("- 包含的记忆数量:", firstCluster.memory_ids.length);
      console.log("- 主题:", firstCluster.topic || "(空)");
    }
    
    // 测试完成
    colorLog("Python聚类服务测试完成", "success");
    return true;
  } catch (error) {
    colorLog(`测试Python聚类服务出错: ${error}`, "error");
    console.error(error);
    return false;
  }
}

// 执行测试
async function main() {
  try {
    // 测试Python聚类
    const clusteringResult = await testPythonClustering();
    
    if (clusteringResult) {
      colorLog("测试通过", "success");
      process.exit(0);
    } else {
      colorLog("测试失败", "error");
      process.exit(1);
    }
  } catch (error) {
    colorLog(`执行测试时发生错误: ${error}`, "error");
    process.exit(1);
  }
}

// 执行主测试函数
main().catch(error => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});