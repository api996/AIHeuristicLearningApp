/**
 * 聚类测试运行工具
 * 提供命令行参数运行不同的测试场景
 */

import { exec } from 'child_process';
import readline from 'readline';

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色日志函数
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',   // 绿色
    warning: '\x1b[33m%s\x1b[0m',   // 黄色
    error: '\x1b[31m%s\x1b[0m',     // 红色
    header: '\x1b[35m%s\x1b[0m',    // 紫色
    highlight: '\x1b[1m\x1b[37m%s\x1b[0m' // 加粗白色
  };
  
  console.log(colors[type], message);
}

// 执行脚本
function executeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    colorLog(`执行脚本: ${scriptPath}`, 'header');
    
    const childProcess = exec(`node ${scriptPath}`, {
      maxBuffer: 10 * 1024 * 1024 // 10MB缓冲区
    });
    
    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        colorLog(`脚本 ${scriptPath} 执行成功`, 'success');
        resolve();
      } else {
        colorLog(`脚本 ${scriptPath} 执行失败，退出码: ${code}`, 'error');
        reject(new Error(`执行脚本失败，退出码: ${code}`));
      }
    });
  });
}

// 显示菜单
function showMenu() {
  colorLog('\n==== 聚类测试工具 ====', 'header');
  colorLog('请选择要执行的操作:', 'highlight');
  colorLog('1. 生成多样化测试数据');
  colorLog('2. 运行完整聚类测试流程');
  colorLog('3. 依次执行所有步骤 (1+2)');
  colorLog('0. 退出');
  colorLog('\n请输入你的选择 (0-3):', 'highlight');
}

// 处理用户选择
async function processChoice(choice) {
  try {
    switch (choice) {
      case '1':
        colorLog('生成多样化测试数据...', 'info');
        await executeScript('./scripts/generate_diverse_test_data.js');
        break;
        
      case '2':
        colorLog('运行完整聚类测试流程...', 'info');
        await executeScript('./scripts/test_flask_clustering_flow.js');
        break;
        
      case '3':
        colorLog('依次执行所有步骤...', 'info');
        await executeScript('./scripts/generate_diverse_test_data.js');
        await executeScript('./scripts/test_flask_clustering_flow.js');
        break;
        
      case '0':
        colorLog('退出程序', 'info');
        rl.close();
        return false;
        
      default:
        colorLog('无效的选择，请重试', 'warning');
        break;
    }
    
    return true;
  } catch (error) {
    colorLog(`操作失败: ${error.message}`, 'error');
    return true;
  }
}

// 主程序
async function main() {
  let continueRunning = true;
  
  while (continueRunning) {
    showMenu();
    
    const choice = await new Promise(resolve => {
      rl.question('', resolve);
    });
    
    continueRunning = await processChoice(choice);
  }
  
  process.exit(0);
}

// 启动主程序
main().catch(error => {
  colorLog(`程序运行出错: ${error.message}`, 'error');
  process.exit(1);
});