/**
 * 知识图谱数据格式测试脚本
 * 
 * 用于测试知识图谱API返回的数据格式是否符合预期，
 * 特别是与学习路径API的数据格式一致性
 */

import axios from 'axios';
import util from 'util';

// ANSI颜色码，用于美化输出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
  },
  
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m"
  }
};

// 彩色日志输出
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let coloredMessage;
  
  switch(type) {
    case 'success':
      coloredMessage = `${colors.fg.green}${timestamp} ✓ ${message}${colors.reset}`;
      break;
    case 'error':
      coloredMessage = `${colors.fg.red}${timestamp} ✗ ${message}${colors.reset}`;
      break;
    case 'warning':
      coloredMessage = `${colors.fg.yellow}${timestamp} ⚠ ${message}${colors.reset}`;
      break;
    case 'info':
    default:
      coloredMessage = `${colors.fg.cyan}${timestamp} ℹ ${message}${colors.reset}`;
      break;
  }
  
  console.log(coloredMessage);
}

/**
 * 测试学习路径API
 */
async function testLearningPathAPI(userId = 6) {
  log(`获取用户 ${userId} 的学习路径数据...`);
  
  try {
    const response = await axios.get(`http://localhost:5000/api/learning-path/${userId}`);
    const data = response.data;
    
    log(`学习路径API返回成功，数据结构如下：`, 'success');
    log(`节点数量: ${data.nodes?.length || 0}`);
    log(`连接数量: ${data.links?.length || 0}`);
    
    // 检查节点格式
    if (data.nodes && data.nodes.length > 0) {
      log('节点结构示例:');
      console.log(util.inspect(data.nodes[0], {colors: true, depth: 3}));
      
      // 检查节点必要字段
      const nodeProps = new Set(Object.keys(data.nodes[0]));
      const requiredNodeProps = ['id', 'label', 'category', 'size'];
      const missingNodeProps = requiredNodeProps.filter(prop => !nodeProps.has(prop));
      
      if (missingNodeProps.length > 0) {
        log(`节点缺少必要字段: ${missingNodeProps.join(', ')}`, 'error');
      } else {
        log('节点结构符合要求', 'success');
      }
    }
    
    // 检查连接格式
    if (data.links && data.links.length > 0) {
      log('连接结构示例:');
      console.log(util.inspect(data.links[0], {colors: true, depth: 3}));
      
      // 检查连接必要字段
      const linkProps = new Set(Object.keys(data.links[0]));
      const requiredLinkProps = ['source', 'target', 'value', 'type'];
      const missingLinkProps = requiredLinkProps.filter(prop => !linkProps.has(prop));
      
      if (missingLinkProps.length > 0) {
        log(`连接缺少必要字段: ${missingLinkProps.join(', ')}`, 'error');
      } else {
        log('连接结构符合要求', 'success');
      }
    }
    
    return data;
  } catch (error) {
    log(`获取学习路径数据失败: ${error.message}`, 'error');
    if (error.response) {
      log(`状态码: ${error.response.status}`, 'error');
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'error');
    }
    return null;
  }
}

/**
 * 测试知识图谱API
 */
async function testKnowledgeGraphAPI(userId = 6) {
  log(`获取用户 ${userId} 的知识图谱数据...`);
  
  try {
    const response = await axios.get(`http://localhost:5000/api/learning-path/${userId}/knowledge-graph`);
    const data = response.data;
    
    log(`知识图谱API返回成功，数据结构如下：`, 'success');
    log(`节点数量: ${data.nodes?.length || 0}`);
    log(`连接数量: ${data.links?.length || 0}`);
    
    // 检查节点格式
    if (data.nodes && data.nodes.length > 0) {
      log('节点结构示例:');
      console.log(util.inspect(data.nodes[0], {colors: true, depth: 3}));
      
      // 检查节点必要字段
      const nodeProps = new Set(Object.keys(data.nodes[0]));
      const requiredNodeProps = ['id', 'label', 'category', 'size'];
      const missingNodeProps = requiredNodeProps.filter(prop => !nodeProps.has(prop));
      
      if (missingNodeProps.length > 0) {
        log(`节点缺少必要字段: ${missingNodeProps.join(', ')}`, 'error');
      } else {
        log('节点结构符合要求', 'success');
      }
    }
    
    // 检查连接格式
    if (data.links && data.links.length > 0) {
      log('连接结构示例:');
      console.log(util.inspect(data.links[0], {colors: true, depth: 3}));
      
      // 检查连接必要字段
      const linkProps = new Set(Object.keys(data.links[0]));
      const requiredLinkProps = ['source', 'target', 'value', 'type'];
      const missingLinkProps = requiredLinkProps.filter(prop => !linkProps.has(prop));
      
      if (missingLinkProps.length > 0) {
        log(`连接缺少必要字段: ${missingLinkProps.join(', ')}`, 'error');
      } else {
        log('连接结构符合要求', 'success');
      }
    }
    
    return data;
  } catch (error) {
    log(`获取知识图谱数据失败: ${error.message}`, 'error');
    if (error.response) {
      log(`状态码: ${error.response.status}`, 'error');
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'error');
    }
    return null;
  }
}

/**
 * 比较两个API的数据结构
 */
function compareDataStructures(learningPathData, knowledgeGraphData) {
  if (!learningPathData || !knowledgeGraphData) {
    log('无法比较数据结构，至少有一个API请求失败', 'error');
    return;
  }
  
  log('===== 数据结构比较 =====');
  
  // 比较节点字段
  if (learningPathData.nodes && learningPathData.nodes.length > 0 &&
      knowledgeGraphData.nodes && knowledgeGraphData.nodes.length > 0) {
    
    const lpNodeFields = Object.keys(learningPathData.nodes[0]).sort();
    const kgNodeFields = Object.keys(knowledgeGraphData.nodes[0]).sort();
    
    log('学习路径节点字段: ' + lpNodeFields.join(', '));
    log('知识图谱节点字段: ' + kgNodeFields.join(', '));
    
    const missingInKg = lpNodeFields.filter(field => !kgNodeFields.includes(field));
    const missingInLp = kgNodeFields.filter(field => !lpNodeFields.includes(field));
    
    if (missingInKg.length > 0) {
      log(`知识图谱节点缺少学习路径中的字段: ${missingInKg.join(', ')}`, 'warning');
    }
    
    if (missingInLp.length > 0) {
      log(`学习路径节点缺少知识图谱中的字段: ${missingInLp.join(', ')}`, 'warning');
    }
    
    if (missingInKg.length === 0 && missingInLp.length === 0) {
      log('节点字段完全一致', 'success');
    }
  }
  
  // 比较连接字段
  if (learningPathData.links && learningPathData.links.length > 0 &&
      knowledgeGraphData.links && knowledgeGraphData.links.length > 0) {
    
    const lpLinkFields = Object.keys(learningPathData.links[0]).sort();
    const kgLinkFields = Object.keys(knowledgeGraphData.links[0]).sort();
    
    log('学习路径连接字段: ' + lpLinkFields.join(', '));
    log('知识图谱连接字段: ' + kgLinkFields.join(', '));
    
    const missingInKg = lpLinkFields.filter(field => !kgLinkFields.includes(field));
    const missingInLp = kgLinkFields.filter(field => !lpLinkFields.includes(field));
    
    if (missingInKg.length > 0) {
      log(`知识图谱连接缺少学习路径中的字段: ${missingInKg.join(', ')}`, 'warning');
    }
    
    if (missingInLp.length > 0) {
      log(`学习路径连接缺少知识图谱中的字段: ${missingInLp.join(', ')}`, 'warning');
    }
    
    if (missingInKg.length === 0 && missingInLp.length === 0) {
      log('连接字段完全一致', 'success');
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    log('开始测试学习路径和知识图谱APIs的数据格式...');
    
    // 测试学习路径API
    const learningPathData = await testLearningPathAPI();
    
    // 测试知识图谱API
    const knowledgeGraphData = await testKnowledgeGraphAPI();
    
    // 比较数据结构
    compareDataStructures(learningPathData, knowledgeGraphData);
    
    log('测试完成');
  } catch (error) {
    log(`测试过程中发生错误: ${error.message}`, 'error');
    console.error(error);
  }
}

// 执行主函数
main();