/**
 * 轻量级测试 - 只测试单个嵌入生成
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// 使用彩色输出
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], message);
}

/**
 * 直接调用Python嵌入脚本生成嵌入
 */
async function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时文件
      const tempDir = path.join(os.tmpdir(), 'ai-embeddings');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.join(tempDir, `text_${Date.now()}.txt`);
      const outputFilePath = path.join(tempDir, `embedding_${Date.now()}.json`);
      
      // 写入文本到临时文件
      fs.writeFileSync(tempFilePath, text);
      
      // 确定Python脚本路径
      const scriptPath = path.join('server', 'services', 'api', 'embedding', 'direct_embed.py');
      
      colorLog(`执行Python脚本: ${scriptPath}`, 'info');
      
      // 启动Python进程
      const startTime = Date.now();
      const pythonProcess = spawn('python3', [scriptPath, tempFilePath, outputFilePath]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        colorLog(`[Python输出] ${data.toString().trim()}`, 'info');
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        colorLog(`[Python错误] ${data.toString().trim()}`, 'error');
      });
      
      pythonProcess.on('close', (code) => {
        const elapsedTime = Date.now() - startTime;
        
        // 清理临时输入文件
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          colorLog(`清理临时文件失败: ${error}`, 'error');
        }
        
        if (code !== 0) {
          colorLog(`Python进程异常退出，代码: ${code}，耗时: ${elapsedTime}ms`, 'error');
          reject(new Error(`Python进程异常退出: ${stderr || 'Unknown error'}`));
          return;
        }
        
        // 读取结果
        try {
          if (fs.existsSync(outputFilePath)) {
            const result = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));
            
            // 清理临时输出文件
            fs.unlinkSync(outputFilePath);
            
            if (result.success && result.embedding) {
              colorLog(`嵌入生成成功，维度: ${result.dimensions}，耗时: ${elapsedTime}ms`, 'success');
              resolve(result.embedding);
            } else {
              colorLog(`嵌入生成失败: ${result.error || 'Unknown error'}`, 'error');
              reject(new Error(result.error || 'Unknown error'));
            }
          } else {
            colorLog(`输出文件不存在: ${outputFilePath}`, 'error');
            reject(new Error('输出文件不存在'));
          }
        } catch (error) {
          colorLog(`处理输出文件时出错: ${error}`, 'error');
          reject(error);
        }
      });
    } catch (error) {
      colorLog(`生成嵌入时出错: ${error}`, 'error');
      reject(error);
    }
  });
}

/**
 * 测试嵌入生成
 */
async function testEmbedding() {
  try {
    colorLog('===== 测试向量嵌入生成 =====', 'info');
    
    // 测试文本
    const testText = '这是一个简短的测试句子';
    colorLog(`测试文本: "${testText}"`, 'info');
    
    // 生成嵌入向量
    colorLog('开始生成嵌入...', 'info');
    const embedding = await generateEmbedding(testText);
    
    if (embedding && Array.isArray(embedding)) {
      colorLog(`嵌入向量维度: ${embedding.length}`, 'success');
      colorLog(`嵌入向量前5个值: [${embedding.slice(0, 5).join(', ')}]`, 'info');
      return embedding;
    } else {
      colorLog('嵌入生成失败，返回无效结果', 'error');
      return null;
    }
  } catch (error) {
    colorLog(`嵌入生成出错: ${error}`, 'error');
    return null;
  }
}

// 主函数
async function main() {
  colorLog('开始测试向量嵌入服务...', 'info');
  await testEmbedding();
  colorLog('测试完成', 'success');
}

// 运行主函数
main().catch(error => {
  colorLog(`测试过程出错: ${error}`, 'error');
});