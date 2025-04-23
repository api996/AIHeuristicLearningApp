/**
 * Flask API直接测试脚本
 * 不依赖任何导入，直接使用Node.js内置模块测试
 */

import http from 'http';

// 颜色日志
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',   // 绿色
    warning: '\x1b[33m%s\x1b[0m',   // 黄色
    error: '\x1b[31m%s\x1b[0m',     // 红色
  };
  
  console.log(colors[type], message);
}

/**
 * 简单的HTTP请求函数
 * @param {Object} options - 请求选项
 * @param {string} data - 请求体数据
 * @returns {Promise<Object>} 响应对象
 */
function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: responseData ? JSON.parse(responseData) : {}
            });
          } else {
            reject(new Error(`HTTP Error: ${res.statusCode} - ${responseData}`));
          }
        } catch (error) {
          reject(new Error(`解析响应数据出错: ${error.message}, 原始数据: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

/**
 * 测试Flask API的健康端点
 */
async function testHealthEndpoint() {
  colorLog('测试Flask API健康端点...', 'info');
  
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/health',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await httpRequest(options);
    colorLog(`健康检查成功: ${JSON.stringify(response.data)}`, 'success');
    return true;
  } catch (error) {
    colorLog(`健康检查失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 测试聚类API
 */
async function testClusteringEndpoint() {
  colorLog('测试聚类API端点...', 'info');
  
  // 创建简单的测试向量数据
  const testVectors = [];
  for (let i = 0; i < 20; i++) {
    // 创建两组不同的向量，以便聚类可以区分它们
    let vector;
    if (i < 10) {
      // 第一组向量
      vector = Array(10).fill(0).map(() => Math.random() * 0.5);
    } else {
      // 第二组向量
      vector = Array(10).fill(0).map(() => 0.5 + Math.random() * 0.5);
    }
    
    testVectors.push({
      id: `test_${i}`,
      vector: vector
    });
  }
  
  const data = JSON.stringify(testVectors);
  
  const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/cluster',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  try {
    const response = await httpRequest(options, data);
    
    // 验证响应格式
    if (!response.data || !response.data.centroids || !Array.isArray(response.data.centroids)) {
      throw new Error('响应格式不正确，缺少centroids字段或格式不对');
    }
    
    colorLog(`聚类测试成功，发现${response.data.centroids.length}个聚类`, 'success');
    
    // 显示每个聚类的点数
    response.data.centroids.forEach((cluster, index) => {
      const pointCount = cluster.points ? cluster.points.length : 0;
      colorLog(`聚类 ${index+1}: ${pointCount}个点`, 'info');
    });
    
    return response.data;
  } catch (error) {
    colorLog(`聚类测试失败: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  colorLog('开始测试Flask聚类API...', 'info');
  
  try {
    // 测试健康端点
    await testHealthEndpoint();
    
    // 测试聚类端点
    const clusterResult = await testClusteringEndpoint();
    
    colorLog('所有测试完成!', 'success');
    return clusterResult;
  } catch (error) {
    colorLog(`测试过程出错: ${error.message}`, 'error');
    process.exit(1);
  }
}

// 执行测试
runTests();