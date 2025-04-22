/**
 * Python聚类服务测试脚本
 */

import fetch from 'node-fetch';

async function testPythonClustering() {
  try {
    console.log('开始测试Python聚类服务...');
    
    const response = await fetch('http://localhost:5000/api/test/python-clustering');
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('测试结果:', data);
    
    if (data.success) {
      console.log('✅ 测试成功: Python聚类服务正常工作');
    } else {
      console.log('❌ 测试失败:', data.message);
    }
    
    return data;
  } catch (error) {
    console.error('❌ 测试出错:', error);
  }
}

// 运行测试
testPythonClustering();