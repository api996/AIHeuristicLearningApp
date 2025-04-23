/**
 * 知识图谱数据格式测试脚本
 * 
 * 用于测试知识图谱API返回的数据格式是否符合预期，
 * 特别是与学习路径API的数据格式一致性
 */

import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

/**
 * 清除知识图谱缓存
 */
async function clearKnowledgeGraphCache(userId = 6) {
  try {
    log(`清除用户${userId}的知识图谱缓存...`);
    
    const response = await axios.post(`http://localhost:5000/api/learning-path/${userId}/clear-cache`);
    
    if (response.data.success) {
      log(`缓存清除成功: ${response.data.message}`, 'success');
      return true;
    } else {
      log(`缓存清除失败: ${response.data.error || '未知错误'}`, 'error');
      return false;
    }
  } catch (error) {
    log(`清除缓存时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 测试学习路径API
 */
async function testLearningPathAPI(userId = 6) {
  try {
    log(`测试用户${userId}的学习路径API`);
    
    const response = await axios.get(`http://localhost:5000/api/learning-path/${userId}`);
    
    log(`学习路径API响应成功，获取${response.data.nodes.length}个节点和${response.data.connections.length}个连接`, 'success');
    
    // 保存样本到文件以便后续比较
    fs.writeFileSync('./learning_path_sample.json', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    log(`测试学习路径API时出错: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 测试知识图谱API
 */
async function testKnowledgeGraphAPI(userId = 6) {
  try {
    log(`测试用户${userId}的知识图谱API`);
    
    const response = await axios.get(`http://localhost:5000/api/learning-path/${userId}/knowledge-graph`);
    
    log(`知识图谱API响应成功，获取${response.data.nodes.length}个节点和${response.data.links.length}个连接`, 'success');
    
    // 保存样本到文件以便后续比较
    fs.writeFileSync('./knowledge_graph_sample.json', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    log(`测试知识图谱API时出错: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 比较两个API的数据结构
 */
function compareDataStructures(learningPathData, knowledgeGraphData) {
  if (!learningPathData || !knowledgeGraphData) {
    log('无法比较数据结构，数据不完整', 'error');
    return false;
  }
  
  log('比较学习路径和知识图谱数据结构...');
  
  // 检查节点结构
  const lpNode = learningPathData.nodes[0] || {};
  const kgNode = knowledgeGraphData.nodes[0] || {};
  
  log('学习路径节点字段: ' + Object.keys(lpNode).join(', '));
  log('知识图谱节点字段: ' + Object.keys(kgNode).join(', '));
  
  // 检查连接结构
  const lpConnection = learningPathData.connections[0] || {};
  const kgLink = knowledgeGraphData.links[0] || {};
  
  log('学习路径连接字段: ' + Object.keys(lpConnection).join(', '));
  log('知识图谱连接字段: ' + Object.keys(kgLink).join(', '));
  
  // 检查节点字段的差异
  const nodeFieldDiff = compareFields(lpNode, kgNode);
  if (nodeFieldDiff.missing.length > 0 || nodeFieldDiff.extra.length > 0) {
    log('节点字段差异:', 'warning');
    if (nodeFieldDiff.missing.length > 0) {
      log(`  知识图谱节点缺少的字段: ${nodeFieldDiff.missing.join(', ')}`, 'warning');
    }
    if (nodeFieldDiff.extra.length > 0) {
      log(`  知识图谱节点多出的字段: ${nodeFieldDiff.extra.join(', ')}`, 'warning');
    }
  } else {
    log('节点字段完全匹配！', 'success');
  }
  
  // 检查连接字段的差异
  const connectionFieldDiff = compareFields(lpConnection, kgLink);
  if (connectionFieldDiff.missing.length > 0 || connectionFieldDiff.extra.length > 0) {
    log('连接字段差异:', 'warning');
    if (connectionFieldDiff.missing.length > 0) {
      log(`  知识图谱连接缺少的字段: ${connectionFieldDiff.missing.join(', ')}`, 'warning');
    }
    if (connectionFieldDiff.extra.length > 0) {
      log(`  知识图谱连接多出的字段: ${connectionFieldDiff.extra.join(', ')}`, 'warning');
    }
  } else {
    log('连接字段完全匹配！', 'success');
  }
  
  // 检查字段名称差异
  checkFieldNameDifferences(learningPathData, knowledgeGraphData);
  
  return nodeFieldDiff.missing.length === 0 && connectionFieldDiff.missing.length === 0;
}

/**
 * 比较两个对象的字段
 */
function compareFields(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  const missing = keys1.filter(key => !keys2.includes(key));
  const extra = keys2.filter(key => !keys1.includes(key));
  
  return { missing, extra };
}

/**
 * 检查字段名称差异（例如links vs connections）
 */
function checkFieldNameDifferences(learningPathData, knowledgeGraphData) {
  const lpKeys = Object.keys(learningPathData);
  const kgKeys = Object.keys(knowledgeGraphData);
  
  // 检查学习路径API是否使用connections
  if (lpKeys.includes('connections') && !kgKeys.includes('connections')) {
    log('学习路径API使用 "connections"，但知识图谱API使用 "links"', 'warning');
  }
  
  // 检查其他顶级字段差异
  const topLevelDiff = compareFields(learningPathData, knowledgeGraphData);
  if (topLevelDiff.missing.length > 0 || topLevelDiff.extra.length > 0) {
    log('顶级字段差异:', 'warning');
    if (topLevelDiff.missing.length > 0) {
      log(`  知识图谱缺少的顶级字段: ${topLevelDiff.missing.join(', ')}`, 'warning');
    }
    if (topLevelDiff.extra.length > 0) {
      log(`  知识图谱多出的顶级字段: ${topLevelDiff.extra.join(', ')}`, 'warning');
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const userId = 6; // 使用默认测试用户
    
    // 首先清除缓存，确保获取最新数据
    await clearKnowledgeGraphCache(userId);
    
    // 获取学习路径数据
    const learningPathData = await testLearningPathAPI(userId);
    
    // 获取知识图谱数据
    const knowledgeGraphData = await testKnowledgeGraphAPI(userId);
    
    // 比较数据结构
    const isStructureConsistent = compareDataStructures(learningPathData, knowledgeGraphData);
    
    if (isStructureConsistent) {
      log('数据结构一致性检查通过！', 'success');
    } else {
      log('数据结构存在差异，请查看上面的详细信息', 'warning');
    }
  } catch (error) {
    log(`测试过程中出错: ${error.message}`, 'error');
  }
}

// 执行主函数
main().catch(console.error);