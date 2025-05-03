/**
 * 测试主题图谱和知识图谱API的整合
 * 这个脚本用于验证主题图谱API是否成功重定向到知识图谱API
 */

import fetch from 'node-fetch';

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m',   // 红色
    reset: '\x1b[0m'     // 重置
  };
  
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
}

async function testTopicGraphDiagnoseAPI() {
  try {
    log('测试主题图谱诊断API...');
    const response = await fetch('http://localhost:5000/api/topic-graph/diagnose-api');
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log('诊断API返回结果:', 'success');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    log(`诊断API测试失败: ${error.message}`, 'error');
    return null;
  }
}

async function testTopicGraphAPI(userId = 1) {
  try {
    log(`测试主题图谱API (用户ID: ${userId})...`);
    const response = await fetch(`http://localhost:5000/api/topic-graph/${userId}`);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log('主题图谱API返回结果:', 'success');
    console.log(`节点数: ${data.nodes?.length || 0}, 连接数: ${data.links?.length || 0}`);
    
    // 检查重定向标记
    if (data.redirected) {
      log('确认: 请求已成功重定向到知识图谱API', 'success');
    }
    
    // 分析连接类型
    if (data.links && data.links.length > 0) {
      const typeCount = {};
      data.links.forEach(link => {
        typeCount[link.type] = (typeCount[link.type] || 0) + 1;
      });
      
      log('连接类型统计:', 'info');
      console.log(typeCount);
      
      // 检查是否有多种关系类型而不只是"related"
      const relationTypes = Object.keys(typeCount);
      if (relationTypes.length > 1 || (relationTypes.length === 1 && relationTypes[0] !== 'related')) {
        log('成功: 发现多种关系类型', 'success');
      } else {
        log('警告: 只发现单一关系类型', 'warning');
      }
      
      // 检查一个示例连接
      const sampleLink = data.links[0];
      log('示例连接:', 'info');
      console.log({
        source: sampleLink.source,
        target: sampleLink.target,
        type: sampleLink.type,
        color: sampleLink.color,
        label: sampleLink.label || sampleLink.type
      });
    }
    
    return data;
  } catch (error) {
    log(`主题图谱API测试失败: ${error.message}`, 'error');
    return null;
  }
}

async function testKnowledgeGraphAPI(userId = 1) {
  try {
    log(`测试知识图谱API (用户ID: ${userId})...`);
    const response = await fetch(`http://localhost:5000/api/learning-path/${userId}/knowledge-graph`);
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log('知识图谱API返回结果:', 'success');
    console.log(`节点数: ${data.nodes?.length || 0}, 连接数: ${data.links?.length || 0}`);
    
    // 分析连接类型
    if (data.links && data.links.length > 0) {
      const typeCount = {};
      data.links.forEach(link => {
        typeCount[link.type] = (typeCount[link.type] || 0) + 1;
      });
      
      log('连接类型统计:', 'info');
      console.log(typeCount);
      
      // 检查是否有多种关系类型而不只是"related"
      const relationTypes = Object.keys(typeCount);
      if (relationTypes.length > 1 || (relationTypes.length === 1 && relationTypes[0] !== 'related')) {
        log('成功: 发现多种关系类型', 'success');
      } else {
        log('警告: 只发现单一关系类型', 'warning');
      }
      
      // 检查一个示例连接
      const sampleLink = data.links[0];
      log('示例连接:', 'info');
      console.log({
        source: sampleLink.source,
        target: sampleLink.target,
        type: sampleLink.type,
        color: sampleLink.color,
        label: sampleLink.label || sampleLink.type
      });
    }
    
    return data;
  } catch (error) {
    log(`知识图谱API测试失败: ${error.message}`, 'error');
    return null;
  }
}

async function compareResponses() {
  log('比较主题图谱和知识图谱API响应...');
  
  const userId = 1; // 使用相同的用户ID进行测试
  
  const topicData = await testTopicGraphAPI(userId);
  const knowledgeData = await testKnowledgeGraphAPI(userId);
  
  if (topicData && knowledgeData) {
    // 基本信息比较
    const topicNodeCount = topicData.nodes?.length || 0;
    const knowledgeNodeCount = knowledgeData.nodes?.length || 0;
    
    if (topicNodeCount === knowledgeNodeCount) {
      log(`节点数匹配: ${topicNodeCount}`, 'success');
    } else {
      log(`节点数不匹配: 主题图谱 ${topicNodeCount}, 知识图谱 ${knowledgeNodeCount}`, 'warning');
    }
    
    const topicLinkCount = topicData.links?.length || 0;
    const knowledgeLinkCount = knowledgeData.links?.length || 0;
    
    if (topicLinkCount === knowledgeLinkCount) {
      log(`连接数匹配: ${topicLinkCount}`, 'success');
    } else {
      log(`连接数不匹配: 主题图谱 ${topicLinkCount}, 知识图谱 ${knowledgeLinkCount}`, 'warning');
    }
    
    // 检查redirected标志
    if (topicData.redirected) {
      log('主题图谱API成功重定向：redirected标志存在', 'success');
    } else {
      log('主题图谱API未显示重定向标志', 'warning');
    }
  }
}

// 运行测试
async function runTests() {
  log('开始API整合测试...');
  
  // 首先测试诊断API
  await testTopicGraphDiagnoseAPI();
  
  // 比较两个API的响应
  await compareResponses();
  
  log('测试完成', 'success');
}

runTests().catch(error => {
  log(`测试过程中发生错误: ${error.message}`, 'error');
});