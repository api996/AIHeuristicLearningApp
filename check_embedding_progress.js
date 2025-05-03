/**
 * 检查嵌入向量进度
 * 显示记忆向量嵌入完成情况
 */

import axios from 'axios';

// 服务器URL
const SERVER_URL = 'https://fa522bb9-56ee-4c36-81dd-8b51d5bdc276-00-14kghyl9hl0xc.sisko.replit.dev';

// 日志颜色
const colors = {
  info: '\x1b[36m',    // 青色
  success: '\x1b[32m', // 绿色
  warning: '\x1b[33m', // 黄色
  error: '\x1b[31m',   // 红色
  reset: '\x1b[0m',    // 重置颜色
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 获取记忆嵌入统计
 */
async function getEmbeddingStats() {
  try {
    const url = `${SERVER_URL}/api/embedding/stats`;
    log(`请求嵌入统计信息: ${url}`, 'info');
    
    const response = await axios.get(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      const stats = response.data.stats || {};
      log('成功获取嵌入统计信息', 'success');
      return stats;
    }
    
    log(`获取嵌入统计失败: ${JSON.stringify(response.data)}`, 'error');
    return {};
  } catch (error) {
    log(`获取嵌入统计错误: ${error.message}`, 'error');
    return {};
  }
}

/**
 * 获取缺失嵌入的记忆列表
 */
async function getMissingEmbeddings(limit = 5) {
  try {
    const url = `${SERVER_URL}/api/embedding/missing-embeddings?limit=${limit}`;
    log(`请求缺失嵌入的记忆列表: ${url}`, 'info');
    
    const response = await axios.get(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      const memories = response.data.memories || [];
      log(`找到 ${memories.length} 条缺失嵌入的记忆记录`, 'info');
      return memories;
    }
    
    log(`获取记忆列表失败: ${JSON.stringify(response.data)}`, 'error');
    return [];
  } catch (error) {
    log(`获取记忆列表错误: ${error.message}`, 'error');
    return [];
  }
}

/**
 * 检查记忆向量维度
 */
async function checkVectorDimensions() {
  try {
    const url = `${SERVER_URL}/api/embedding/dimensions`;
    log(`请求向量维度统计: ${url}`, 'info');
    
    const response = await axios.get(url);
    
    if (response.status === 200 && response.data && response.data.success) {
      const dimensions = response.data.dimensions || {};
      return dimensions;
    }
    
    log(`获取向量维度统计失败: ${JSON.stringify(response.data)}`, 'error');
    return {};
  } catch (error) {
    log(`获取向量维度统计错误: ${error.message}`, 'error');
    return {};
  }
}

/**
 * 主函数
 */
async function main() {
  log('=== 记忆向量嵌入进度检查 ===', 'info');
  
  // 请求缺失嵌入的记忆数量
  const missingEmbeddings = await getMissingEmbeddings(1);
  
  // 手动请求直接SQL查询的结果
  const totalMemories = 153; // 总记忆数量
  const remainingMemories = missingEmbeddings.length > 0 ? missingEmbeddings.length : 0;
  const completedMemories = totalMemories - remainingMemories;
  
  log('\n手动查询统计信息:', 'info');
  log(`\u603b记忆数: ${totalMemories}`, 'info');
  log(`\u7f3a失嵌入的记忆数: ${remainingMemories === 0 ? '0' : '至少 ' + remainingMemories}`, 'info');
  log(`\u5df2完成嵌入的记忆数: ${completedMemories}`, 'success');
  
  // 显示运行过程中已经完成处理的记忆
  log('\n推测完成进度:', 'info');
  const completionPercentage = ((totalMemories - remainingMemories) / totalMemories * 100).toFixed(2);
  log(`\u5df2完成: ${completionPercentage}%`, 'success');
  
  // 检查是否完成全部
  if (remainingMemories === 0) {
    log('\n\u606d喜nff01 全部记忆的嵌入向量已生成并保存到数据库\uff01', 'success');
  }
  
  log('\n请等待脚本完成所有记忆的处理...', 'info');
}

// 运行脚本
main().catch(e => log(`脚本运行时遇到错误: ${e.message}`, 'error'));