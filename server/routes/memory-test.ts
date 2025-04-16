/**
 * 记忆空间测试路由
 * 用于提供内存管理的测试功能接口
 */
import express from 'express';
import { storage } from '../storage';
import path from 'path';
import fs from 'fs';
import { log } from '../vite';
import { utils } from '../utils';
import { spawn } from 'child_process';

const router = express.Router();

/**
 * 测试读取文件系统中的记忆数据
 */
router.get('/file-system/:userId', async (req, res) => {
  // 设置响应类型为JSON
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const userIdNumber = Number(userId);
    const userDir = path.join(process.cwd(), 'memory_space', userId);
    
    if (!fs.existsSync(userDir)) {
      return res.json({ success: true, memories: [], message: `用户${userId}无记忆文件` });
    }

    const files = fs.readdirSync(userDir);
    const memories = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(userDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const memory = JSON.parse(content);
        
        // 确保内存对象有完整的结构
        memory.id = memory.id || path.basename(file, '.json');
        memory.timestamp = memory.timestamp || new Date().toISOString();
        memory.type = memory.type || 'chat';
        memory.summary = memory.summary || memory.content.substring(0, 50) + '...';
        memory.keywords = memory.keywords || [];
        
        memories.push(memory);
      } catch (error) {
        log(`解析记忆文件时出错 ${file}: ${error}`);
      }
    }
    
    return res.json({ 
      success: true, 
      memories,
      count: memories.length,
      message: `成功读取${memories.length}条记忆`
    });
  } catch (error) {
    log(`获取文件系统记忆时出错: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: `获取文件系统记忆时出错: ${error}`
    });
  }
});

/**
 * 将文件系统中的记忆导入到数据库
 */
router.post('/import-to-db/:userId', async (req, res) => {
  // 设置响应类型为JSON
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const userIdNumber = Number(userId);
    const userDir = path.join(process.cwd(), 'memory_space', userId);
    
    if (!fs.existsSync(userDir)) {
      return res.json({ 
        success: false, 
        message: `用户${userId}无记忆文件`, 
        imported: 0 
      });
    }

    const files = fs.readdirSync(userDir);
    let importedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(userDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const memory = JSON.parse(content);
        
        // 从文件名中提取ID，或使用memory对象中的id
        const memoryId = memory.id || path.basename(file, '.json');
        
        // 检查数据库中是否已存在该记忆
        const existingMemory = await storage.getMemoryById(Number(memoryId));
        if (existingMemory) {
          log(`记忆ID ${memoryId} 已存在于数据库中，跳过导入`);
          continue;
        }
        
        // 创建新记忆
        const newMemory = await storage.createMemory(
          userIdNumber,
          memory.content,
          memory.type || 'chat',
          memory.summary
        );
        
        // 如果有关键词，添加关键词
        if (memory.keywords && Array.isArray(memory.keywords)) {
          for (const keyword of memory.keywords) {
            await storage.addKeywordToMemory(newMemory.id, keyword);
          }
        }
        
        // 如果有向量嵌入，添加向量嵌入
        if (memory.embedding && Array.isArray(memory.embedding)) {
          await storage.saveMemoryEmbedding(newMemory.id, memory.embedding);
        }
        
        importedCount++;
      } catch (error) {
        errorCount++;
        errors.push(`${file}: ${error}`);
        log(`导入记忆到数据库时出错 ${file}: ${error}`);
      }
    }
    
    return res.json({ 
      success: true, 
      imported: importedCount,
      errors: errorCount,
      details: errors.length > 0 ? errors : undefined,
      message: `成功导入${importedCount}条记忆，失败${errorCount}条`
    });
  } catch (error) {
    log(`导入记忆到数据库时出错: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: `导入记忆到数据库时出错: ${error}`
    });
  }
});

/**
 * 分析记忆集群
 */
router.get('/analyze-clusters/:userId', async (req, res) => {
  // 设置响应类型为JSON
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const userIdNumber = Number(userId);
    
    // 获取用户的所有记忆
    const memories = await storage.getMemoriesByUserId(userIdNumber);
    
    if (!memories || memories.length === 0) {
      return res.json({ 
        success: true, 
        topics: [],
        message: '没有找到用户记忆数据'
      });
    }
    
    // 如果记忆数量少于5条，返回空结果
    if (memories.length < 5) {
      return res.json({
        success: true,
        topics: [],
        message: `记忆数量(${memories.length})不足，需至少5条记忆`
      });
    }
    
    // 调用Python脚本进行聚类分析
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import json
import sys
import os
# 切换到项目根目录，确保正确的路径
os.chdir('${process.cwd()}')
sys.path.append('server')
import logging
# 重定向所有print输出到stderr，保留stdout只用于JSON输出
sys.stdout = sys.stderr
from services.learning_memory import learning_memory_service

async def analyze():
    result = await learning_memory_service.analyze_memory_clusters(${userIdNumber})
    # 恢复stdout并只输出JSON结果
    sys.stdout = sys.__stdout__
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(analyze())
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        log(`内存聚类分析进程退出，错误码 ${code}: ${errorOutput}`);
        
        // 返回错误信息
        return res.status(500).json({
          success: false,
          message: '分析记忆聚类时出错',
          error: errorOutput
        });
      }
      
      try {
        const result = JSON.parse(output);
        return res.json({
          success: true,
          topics: result.topics || [],
          message: '分析完成'
        });
      } catch (e) {
        log(`解析内存聚类分析结果失败: ${e}`);
        
        return res.status(500).json({
          success: false,
          message: '解析聚类分析结果时出错',
          error: String(e)
        });
      }
    });
  } catch (error) {
    log(`分析记忆聚类时出错: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: `分析记忆聚类时出错: ${error}`
    });
  }
});

/**
 * 修复记忆数据，确保具有摘要和关键词
 */
router.post('/repair/:userId', async (req, res) => {
  // 设置响应类型为JSON
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId } = req.params;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: '无效的用户ID' });
    }

    const userIdNumber = Number(userId);
    
    // 获取用户的所有记忆
    const memories = await storage.getMemoriesByUserId(userIdNumber);
    
    if (!memories || memories.length === 0) {
      return res.json({ 
        success: true, 
        message: '没有找到需要修复的记忆',
        repaired: 0
      });
    }
    
    // 使用Python脚本修复记忆
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import json
import sys
import os
# 切换到项目根目录，确保正确的路径
os.chdir('${process.cwd()}')
sys.path.append('server')
import logging
# 重定向所有print输出到stderr，保留stdout只用于JSON输出
sys.stdout = sys.stderr
from services.learning_memory import learning_memory_service

async def repair():
    result = await learning_memory_service.repair_memories(${userIdNumber})
    # 恢复stdout并只输出JSON结果
    sys.stdout = sys.__stdout__
    print(json.dumps(result, ensure_ascii=False))

asyncio.run(repair())
    `]);
    
    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    let errorOutput = '';
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        log(`记忆修复进程退出，错误码 ${code}: ${errorOutput}`);
        
        // 返回错误信息
        return res.status(500).json({
          success: false,
          message: '修复记忆时出错',
          error: errorOutput
        });
      }
      
      try {
        const result = JSON.parse(output);
        return res.json({
          success: true,
          repaired: result.repaired || 0,
          message: result.message || '修复完成'
        });
      } catch (e) {
        log(`解析记忆修复结果失败: ${e}`);
        
        return res.status(500).json({
          success: false,
          message: '解析修复结果时出错',
          error: String(e)
        });
      }
    });
  } catch (error) {
    log(`修复记忆时出错: ${error}`);
    return res.status(500).json({ 
      success: false, 
      message: `修复记忆时出错: ${error}`
    });
  }
});

export default router;