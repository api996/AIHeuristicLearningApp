/**
 * 学生智能体模拟器测试脚本
 * 此脚本用于测试学生智能体模拟器的API端点是否正常工作
 */

const fetch = require('node-fetch');

// 彩色日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置
  };
  
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${colors.reset}`);
}

// 创建模拟会话
async function createSimulation() {
  try {
    log('开始测试学生智能体模拟器...');
    
    // 模拟管理员用户登录状态 (cookie)
    const response = await fetch('http://localhost:5000/api/student-agent-simulator/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=dummy-session-id-for-testing' // 这里使用模拟的会话ID
      },
      body: JSON.stringify({
        initialPrompt: '请介绍一下中文学习的基本方法',
        maxMessages: 5,
        presetId: 1,  // 使用ID为1的预设
        userId: 6     // 使用ID为6的用户(普通学生用户)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`API错误: ${response.status} - ${errorText}`, 'error');
      return null;
    }

    const data = await response.json();
    log(`成功创建模拟会话，ID: ${data.id}`, 'success');
    
    return data.id;
  } catch (error) {
    log(`测试失败: ${error.message}`, 'error');
    return null;
  }
}

// 获取模拟会话状态
async function getSimulationStatus(simulationId) {
  try {
    log(`获取模拟会话 ${simulationId} 的状态...`);
    
    const response = await fetch(`http://localhost:5000/api/student-agent-simulator/simulate/${simulationId}`, {
      headers: {
        'Cookie': 'connect.sid=dummy-session-id-for-testing' // 这里使用模拟的会话ID
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`获取状态错误: ${response.status} - ${errorText}`, 'error');
      return null;
    }
    
    const data = await response.json();
    log(`模拟会话状态: ${data.status}`, 'info');
    
    if (data.messages && data.messages.length > 0) {
      log(`模拟会话消息数量: ${data.messages.length}`, 'info');
      
      // 显示最后一条消息
      const lastMessage = data.messages[data.messages.length - 1];
      log(`最新消息 (${lastMessage.role}): ${lastMessage.content.substring(0, 100)}...`, 'info');
    } else {
      log('模拟会话暂无消息', 'warning');
    }
    
    return data;
  } catch (error) {
    log(`获取状态失败: ${error.message}`, 'error');
    return null;
  }
}

// 停止模拟会话
async function stopSimulation(simulationId) {
  try {
    log(`停止模拟会话 ${simulationId}...`);
    
    const response = await fetch(`http://localhost:5000/api/student-agent-simulator/simulate/${simulationId}/stop`, {
      method: 'POST',
      headers: {
        'Cookie': 'connect.sid=dummy-session-id-for-testing' // 这里使用模拟的会话ID
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`停止会话错误: ${response.status} - ${errorText}`, 'error');
      return false;
    }
    
    const data = await response.json();
    log(`模拟会话已停止: ${data.success ? '成功' : '失败'}`, data.success ? 'success' : 'error');
    
    return data.success;
  } catch (error) {
    log(`停止会话失败: ${error.message}`, 'error');
    return false;
  }
}

// 运行测试
async function runTest() {
  const simulationId = await createSimulation();
  
  if (!simulationId) {
    log('无法创建模拟会话，测试中止', 'error');
    return;
  }
  
  // 等待5秒
  log('等待5秒以便生成一些消息...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 检查状态
  const status = await getSimulationStatus(simulationId);
  
  if (!status) {
    log('无法获取模拟会话状态，测试中止', 'error');
    return;
  }
  
  // 停止模拟会话
  const stopped = await stopSimulation(simulationId);
  
  if (stopped) {
    log('测试完成', 'success');
  } else {
    log('测试完成，但无法正常停止模拟会话', 'warning');
  }
}

// 运行测试
runTest().catch(error => {
  log(`测试过程中发生错误: ${error.message}`, 'error');
});