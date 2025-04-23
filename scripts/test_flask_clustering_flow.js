/**
 * Flask 聚类服务完整流程测试
 * 从测试数据 -> 向量嵌入 -> 聚类 -> 主题生成 -> 学习轨迹
 */

import axios from 'axios';
import { db } from '../server/db.js';
import { memories } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// 测试配置
const TEST_USER_ID = 15; // 使用测试用户ID
const API_BASE_URL = 'http://localhost:5000'; // 主API服务

// 颜色日志输出
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warning: '\x1b[33m%s\x1b[0m',  // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], `[${type.toUpperCase()}] ${message}`);
}

/**
 * 获取测试用户的记忆数据
 * @returns {Promise<Array>} 记忆数据数组
 */
async function getUserMemories() {
  log(`获取用户ID=${TEST_USER_ID}的记忆数据...`);
  
  try {
    const result = await db.select().from(memories).where(eq(memories.userId, TEST_USER_ID));
    log(`找到${result.length}条记忆记录`, 'success');
    return result;
  } catch (error) {
    log(`获取记忆数据时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 检查记忆向量嵌入
 * @param {Array} userMemories 用户记忆数组
 * @returns {Promise<Array>} 有效向量的记忆数组
 */
async function checkMemoryEmbeddings(userMemories) {
  log(`检查${userMemories.length}条记忆的向量嵌入...`);
  
  const memoriesWithValidVectors = userMemories.filter(memory => {
    try {
      const vector = JSON.parse(memory.vector || '[]');
      return Array.isArray(vector) && vector.length > 0;
    } catch (e) {
      return false;
    }
  });
  
  log(`找到${memoriesWithValidVectors.length}条具有有效向量嵌入的记忆`, 'success');
  
  // 报告向量维度
  if (memoriesWithValidVectors.length > 0) {
    const sampleVector = JSON.parse(memoriesWithValidVectors[0].vector);
    log(`向量维度示例: ${sampleVector.length}`, 'info');
  }
  
  return memoriesWithValidVectors;
}

/**
 * 测试聚类API接口
 * @param {Array} memoriesWithVectors 具有向量的记忆数组
 * @returns {Promise<Object>} 聚类结果
 */
async function testClusteringAPI(memoriesWithVectors) {
  log(`开始测试聚类API，使用${memoriesWithVectors.length}条记忆...`);
  
  try {
    // 构建API请求数据
    const requestData = memoriesWithVectors.map(memory => ({
      id: memory.id,
      vector: JSON.parse(memory.vector)
    }));
    
    // 发送请求到Flask API
    log(`发送聚类请求到 http://localhost:5050/api/cluster...`);
    const response = await axios.post(
      'http://localhost:5050/api/cluster',
      requestData,
      {
        timeout: 600000, // 10分钟超时
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    // 检查结果
    const clusterResult = response.data;
    log(`聚类成功，发现${clusterResult.centroids.length}个聚类`, 'success');
    
    // 统计每个聚类的记忆数量
    clusterResult.centroids.forEach((cluster, index) => {
      log(`聚类 ${index+1}: ${cluster.points.length}条记忆 (${Math.round(cluster.points.length/memoriesWithVectors.length*100)}%)`, 'info');
    });
    
    return clusterResult;
  } catch (error) {
    log(`聚类API请求失败: ${error.message}`, 'error');
    
    // 如果是响应错误，显示详细信息
    if (error.response) {
      log(`状态码: ${error.response.status}`, 'error');
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'error');
    }
    
    throw error;
  }
}

/**
 * 测试完整的记忆服务聚类流程
 * @returns {Promise<Object>} 聚类结果
 */
async function testMemoryServiceClustering() {
  log(`测试记忆服务的聚类流程...`);
  
  try {
    // 调用内部API获取聚类结果
    const response = await axios.get(
      `${API_BASE_URL}/api/clusters?userId=${TEST_USER_ID}`,
      { timeout: 60000 }
    );
    
    // 检查结果
    const result = response.data;
    log(`记忆服务聚类成功，发现${result.topics.length}个主题聚类`, 'success');
    
    // 显示主题信息
    result.topics.forEach((topic, index) => {
      log(`主题 ${index+1}: "${topic.topic}" - ${topic.count}条记忆 (${topic.percentage}%)`, 'info');
    });
    
    return result;
  } catch (error) {
    log(`记忆服务聚类请求失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 测试学习轨迹生成
 * @returns {Promise<Object>} 学习轨迹结果
 */
async function testLearningTrajectory() {
  log(`测试学习轨迹生成...`);
  
  try {
    // 调用学习轨迹API
    const response = await axios.get(
      `${API_BASE_URL}/api/learning-path?userId=${TEST_USER_ID}`,
      { timeout: 60000 }
    );
    
    // 检查结果
    const result = response.data;
    log(`学习轨迹生成成功，包含${result.nodes.length}个节点和${result.links.length}个连接`, 'success');
    
    // 显示节点信息
    result.nodes.forEach((node, index) => {
      log(`节点 ${index+1}: "${node.name}" - 类型: ${node.type}, 组: ${node.group}`, 'info');
    });
    
    // 显示建议信息
    if (result.suggestions && result.suggestions.length > 0) {
      log(`学习建议:`, 'info');
      result.suggestions.forEach((suggestion, index) => {
        log(`建议 ${index+1}: ${suggestion}`, 'info');
      });
    }
    
    return result;
  } catch (error) {
    log(`学习轨迹生成请求失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 运行完整的测试流程
 */
async function runFullTest() {
  try {
    log('开始测试完整的聚类和学习轨迹流程...', 'info');
    
    // 1. 获取测试用户的记忆数据
    const userMemories = await getUserMemories();
    
    // 2. 检查记忆向量嵌入
    const memoriesWithVectors = await checkMemoryEmbeddings(userMemories);
    
    if (memoriesWithVectors.length === 0) {
      log('没有找到有效的向量嵌入，测试终止', 'error');
      return;
    }
    
    // 3. 测试Flask聚类API
    let flaskClusterResult = null;
    try {
      flaskClusterResult = await testClusteringAPI(memoriesWithVectors);
      log('Flask聚类API测试成功', 'success');
    } catch (error) {
      log('Flask聚类API测试失败，继续下一步测试', 'warning');
    }
    
    // 4. 测试记忆服务的聚类流程
    const memoryServiceResult = await testMemoryServiceClustering();
    log('记忆服务聚类测试成功', 'success');
    
    // 5. 测试学习轨迹生成
    const learningTrajectoryResult = await testLearningTrajectory();
    log('学习轨迹生成测试成功', 'success');
    
    log('全部测试流程完成!', 'success');
    
    // 返回结果摘要
    return {
      memoriesCount: userMemories.length,
      vectorsCount: memoriesWithVectors.length,
      flaskClusters: flaskClusterResult ? flaskClusterResult.centroids.length : 0,
      memoryServiceTopics: memoryServiceResult.topics.length,
      learningTrajectoryNodes: learningTrajectoryResult.nodes.length
    };
  } catch (error) {
    log(`测试流程出错: ${error.message}`, 'error');
    throw error;
  }
}

// 运行测试
(async () => {
  try {
    const results = await runFullTest();
    log(`测试摘要: ${JSON.stringify(results, null, 2)}`, 'success');
    process.exit(0);
  } catch (error) {
    log(`测试失败: ${error.message}`, 'error');
    process.exit(1);
  }
})();