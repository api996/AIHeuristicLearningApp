/**
 * 处理特定记忆ID的脚本
 * 使用ESM语法为指定的记忆ID生成向量嵌入
 */

import axios from 'axios';

// 端点配置
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 颜色格式化工具
const color = {
  info: '\x1b[36m',   // 青色
  success: '\x1b[32m', // 绿色
  warn: '\x1b[33m',    // 黄色
  error: '\x1b[31m',   // 红色
  reset: '\x1b[0m',    // 重置颜色
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  console.log(`${color[type]}${message}${color.reset}`);
}

/**
 * 处理单个记忆
 */
async function processMemory(memoryId) {
  try {
    log(`开始处理记忆 ${memoryId}`, 'info');
    
    const url = `${SERVER_URL}/api/embedding/process-memory/${memoryId}`;
    const response = await axios.post(url);
    
    if (response.status === 200 && response.data.success) {
      log(`记忆 ${memoryId} 处理成功, 维度: ${response.data.dimensions || 3072}`, 'success');
      return true;
    } else {
      log(`处理记忆 ${memoryId} 失败: ${JSON.stringify(response.data)}`, 'error');
      return false;
    }
  } catch (error) {
    log(`处理记忆 ${memoryId} 时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  // 指定要处理的记忆ID
  const memoryIds = [
    '20250501050739847134',
    '20250501054642245988',
    '20250430131051817257',
    '20250501061013693258',
    '20250501060103047601'
  ];
  
  log(`===== 开始处理指定记忆ID =====`, 'info');
  log(`将处理 ${memoryIds.length} 条记忆`, 'info');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < memoryIds.length; i++) {
    const memoryId = memoryIds[i];
    log(`\n处理记忆 [${i + 1}/${memoryIds.length}]: ${memoryId}`, 'info');
    
    const success = await processMemory(memoryId);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 等待一秒再处理下一个
    if (i < memoryIds.length - 1) {
      log(`等待 1 秒再处理下一个...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  log(`\n===== 处理完成 =====`, 'info');
  log(`成功: ${successCount} 条`, 'success');
  log(`失败: ${failCount} 条`, 'error');
}

// 执行主函数
main().catch(error => {
  log(`脚本执行出错: ${error.message}`, 'error');
});
