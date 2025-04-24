/**
 * 聚类服务测试脚本
 * 测试Flask聚类服务对不同用户的记忆进行聚类分析
 */

import fetch from 'node-fetch';

// 测试目标用户ID列表
const TEST_USER_IDS = [6, 7]; // 只测试有足够记忆数据的用户
const API_BASE_URL = 'http://localhost:5000';

/**
 * 打印彩色日志信息
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 测试指定用户的聚类分析
 * 注意：直接通过学习轨迹API验证聚类功能是否工作正常
 */
async function testUserClustering(userId) {
  try {
    log(`测试用户 ${userId} 的聚类分析...`, 'info');
    
    // 通过学习轨迹API验证聚类功能
    const url = `${API_BASE_URL}/api/learning-path?userId=${userId}&forceRefresh=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 分析结果中的主题数量表示聚类数量
    const clusterCount = result?.topics?.length || 0;
    
    if (clusterCount > 0) {
      log(`用户 ${userId} 的聚类分析成功: 发现 ${clusterCount} 个聚类主题`, 'success');
      
      // 输出主题信息
      result.topics.forEach((topic, index) => {
        // 确保主题信息可以正确显示
        const topicName = typeof topic === 'object' && topic !== null 
          ? (topic.topic || topic.name || JSON.stringify(topic)) 
          : String(topic);
        log(`  主题 ${index}: ${topicName}`);
      });
      
      return true;
    } else {
      log(`用户 ${userId} 的聚类分析未产生聚类结果`, 'warning');
      return false;
    }
  } catch (error) {
    log(`测试用户 ${userId} 的聚类分析出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 测试指定用户的学习轨迹生成
 */
async function testLearningTrajectory(userId) {
  try {
    log(`测试用户 ${userId} 的学习轨迹生成...`, 'info');
    
    // 强制刷新，确保使用最新数据
    const url = `${API_BASE_URL}/api/learning-path?userId=${userId}&forceRefresh=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }
    
    const result = await response.json();
    
    // 分析结果
    const hasNodes = result?.nodes?.length > 0;
    const hasTopics = result?.topics?.length > 0;
    
    if (hasNodes || hasTopics) {
      log(`用户 ${userId} 的学习轨迹生成成功:`, 'success');
      log(`  节点数量: ${result?.nodes?.length || 0}`);
      log(`  主题数量: ${result?.topics?.length || 0}`);
      log(`  连接数量: ${result?.links?.length || 0}`);
      log(`  建议数量: ${result?.suggestions?.length || 0}`);
      return true;
    } else {
      log(`用户 ${userId} 的学习轨迹生成未产生有效结果`, 'warning');
      return false;
    }
  } catch (error) {
    log(`测试用户 ${userId} 的学习轨迹生成出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  log("=== 开始测试聚类服务和学习轨迹生成 ===", 'info');
  
  // 统计成功率
  let clusteringSuccess = 0;
  let trajectorySuccess = 0;
  
  // 依次测试每个用户
  for (const userId of TEST_USER_IDS) {
    log(`\n开始测试用户 ${userId}...`, 'info');
    
    // 测试聚类分析
    const clusterResult = await testUserClustering(userId);
    if (clusterResult) clusteringSuccess++;
    
    // 等待1秒，避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试学习轨迹生成
    const trajectoryResult = await testLearningTrajectory(userId);
    if (trajectoryResult) trajectorySuccess++;
    
    // 用户测试之间添加分隔
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 输出总结果
  log("\n=== 测试结果汇总 ===", 'info');
  log(`聚类分析成功率: ${clusteringSuccess}/${TEST_USER_IDS.length}`, clusteringSuccess === TEST_USER_IDS.length ? 'success' : 'warning');
  log(`学习轨迹生成成功率: ${trajectorySuccess}/${TEST_USER_IDS.length}`, trajectorySuccess === TEST_USER_IDS.length ? 'success' : 'warning');
  
  if (clusteringSuccess === TEST_USER_IDS.length && trajectorySuccess === TEST_USER_IDS.length) {
    log("所有测试通过!", 'success');
  } else {
    log("部分测试未通过，请检查详细输出", 'warning');
  }
}

// 执行测试
runTests().catch(error => {
  log(`测试执行出错: ${error.message}`, 'error');
});