/**
 * 记忆重置脚本
 * 
 * 本脚本会：
 * 1. 先清理低质量向量数据
 * 2. 然后生成新的测试对话数据
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * 运行指定的脚本
 * @param scriptPath 脚本路径
 * @returns 返回一个Promise，在脚本完成时解析
 */
function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`开始执行脚本: ${scriptPath}`);
    
    // 使用tsx运行TypeScript脚本
    const process = spawn('npx', ['tsx', scriptPath], {
      stdio: 'inherit', // 将脚本的输出直接传递到当前进程
      shell: true
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`脚本 ${scriptPath} 成功完成`);
        resolve();
      } else {
        console.error(`脚本 ${scriptPath} 失败，退出码: ${code}`);
        reject(new Error(`脚本退出码: ${code}`));
      }
    });
    
    process.on('error', (err) => {
      console.error(`启动脚本 ${scriptPath} 时出错:`, err);
      reject(err);
    });
  });
}

/**
 * 主函数：按顺序运行记忆重置流程
 */
async function resetMemoryData() {
  try {
    // 1. 清理低质量向量数据
    console.log('步骤1: 清理低质量向量数据');
    await runScript(path.join(__dirname, 'clean_memory_vectors.ts'));
    
    // 2. 生成新的测试对话数据
    console.log('步骤2: 生成新的测试对话数据');
    await runScript(path.join(__dirname, 'generate_test_conversations.ts'));
    
    console.log('记忆重置流程完成');
  } catch (error) {
    console.error('记忆重置流程失败:', error);
    process.exit(1);
  }
}

// 执行记忆重置流程
resetMemoryData().catch(console.error);