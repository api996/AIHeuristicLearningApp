/**
 * 触发记忆聚类和学习轨迹生成脚本
 * 手动触发记忆聚类、主题生成和学习轨迹分析
 */

import fetch from 'node-fetch';

// 触发记忆聚类和学习轨迹生成的API端点
const BASE_URL = 'http://localhost:5000';
const USERS = [1, 6, 7]; // 测试用户列表

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m', // 重置颜色
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 触发指定用户的记忆聚类
 */
async function triggerClusterAnalysis(userId) {
  try {
    log(`触发用户 ${userId} 的记忆聚类...`, 'info');
    
    const response = await fetch(`${BASE_URL}/api/memories/cluster-analysis?userId=${userId}&forceRefresh=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败，状态码: ${response.status}, 错误: ${errorText}`);
    }
    
    const result = await response.json();
    log(`用户 ${userId} 的记忆聚类结果:`, 'success');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    log(`触发用户 ${userId} 的记忆聚类时出错: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 触发指定用户的学习轨迹生成
 */
async function triggerLearningPath(userId) {
  try {
    log(`触发用户 ${userId} 的学习轨迹生成...`, 'info');
    
    const response = await fetch(`${BASE_URL}/api/learning-path?userId=${userId}&forceRefresh=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API调用失败，状态码: ${response.status}, 错误: ${errorText}`);
    }
    
    const result = await response.json();
    log(`用户 ${userId} 的学习轨迹结果:`, 'success');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    log(`触发用户 ${userId} 的学习轨迹生成时出错: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  log("=== 开始触发记忆聚类和学习轨迹生成 ===", 'info');
  
  for (const userId of USERS) {
    log(`处理用户 ${userId}...`, 'info');
    
    // 触发记忆聚类
    const clusterResult = await triggerClusterAnalysis(userId);
    
    if (clusterResult) {
      log(`用户 ${userId} 的记忆聚类成功完成`, 'success');
      
      // 等待1秒后触发学习轨迹生成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 触发学习轨迹生成
      const pathResult = await triggerLearningPath(userId);
      
      if (pathResult) {
        log(`用户 ${userId} 的学习轨迹生成成功完成`, 'success');
      }
    }
    
    // 在处理下一个用户前等待2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  log("=== 记忆聚类和学习轨迹生成完成 ===", 'success');
}

// 运行主函数
main().catch(e => log(`脚本执行异常: ${e.message}`, 'error'));