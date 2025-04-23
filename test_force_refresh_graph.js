/**
 * 强制刷新知识图谱脚本
 * 用于清除缓存并重新生成知识图谱
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
 * 强制刷新知识图谱
 * @param {number} userId 用户ID
 */
async function forceRefreshGraph(userId) {
  try {
    log(`强制刷新用户 ${userId} 的知识图谱...`);
    
    // 获取清除缓存的API
    const clearCacheUrl = `http://localhost:5000/api/learning-path/${userId}/clear-cache`;
    const response = await axios.post(clearCacheUrl);
    
    if (response.status === 200) {
      log(`成功清除知识图谱缓存`, 'success');
      
      // 重新获取知识图谱（强制刷新）
      const forceRefreshUrl = `http://localhost:5000/api/learning-path/${userId}/knowledge-graph?force=true`;
      const graphResponse = await axios.get(forceRefreshUrl);
      
      if (graphResponse.status === 200) {
        log(`成功重新生成知识图谱，数据如下：`, 'success');
        log(`节点数量: ${graphResponse.data.nodes.length}`);
        log(`连接数量: ${graphResponse.data.links.length}`);
        
        // 检查节点格式
        if (graphResponse.data.nodes && graphResponse.data.nodes.length > 0) {
          log('节点结构示例:');
          console.log(util.inspect(graphResponse.data.nodes[0], {colors: true, depth: 3}));
        }
        
        return true;
      } else {
        log(`获取知识图谱失败: ${graphResponse.status}`, 'error');
        return false;
      }
    } else {
      log(`清除缓存失败: ${response.status}`, 'error');
      return false;
    }
  } catch (error) {
    log(`操作失败: ${error.message}`, 'error');
    if (error.response) {
      log(`状态码: ${error.response.status}`, 'error');
      log(`响应数据: ${JSON.stringify(error.response.data)}`, 'error');
    }
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const userId = 6; // 默认用户ID
    const success = await forceRefreshGraph(userId);
    
    if (success) {
      log(`知识图谱刷新完成，现在运行测试脚本检查数据格式...`, 'info');
      
      // 尝试在刷新后执行测试
      const { exec } = await import('child_process');
      exec('node test_knowledge_graph_format.js', (error, stdout, stderr) => {
        if (error) {
          log(`测试脚本执行失败: ${error.message}`, 'error');
          return;
        }
        if (stderr) {
          log(`测试脚本错误: ${stderr}`, 'error');
          return;
        }
        console.log(stdout); // 直接输出测试结果
      });
    } else {
      log(`知识图谱刷新失败，跳过测试`, 'warning');
    }
  } catch (error) {
    log(`执行过程中发生错误: ${error.message}`, 'error');
    console.error(error);
  }
}

// 执行主函数
main();