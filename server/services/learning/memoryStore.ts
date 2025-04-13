/**
 * 记忆存储服务模块
 * 负责记忆的保存、检索和管理
 */

import { spawn } from 'child_process';
import { Memory, MemoryFilter, SimilarityOptions } from './types';
import { log } from '../../vite';
import path from 'path';
import fs from 'fs';

// 记忆空间目录
const MEMORY_DIR = 'memory_space';

/**
 * 保存记忆到存储
 * 
 * @param memory 要保存的记忆对象（不包含ID）
 * @returns 保存后的完整记忆对象
 */
export async function saveMemory(memory: Omit<Memory, 'id'>): Promise<Memory> {
  try {
    if (!memory.userId || !memory.content) {
      throw new Error('记忆必须包含用户ID和内容');
    }

    log(`[memoryStore] 尝试保存记忆: 用户=${memory.userId}, 内容长度=${memory.content.length}, 类型=${memory.type || 'chat'}`);

    // 确保记忆对象有必要的字段
    const memoryToSave = {
      content: memory.content,
      type: memory.type || 'chat',
      timestamp: memory.timestamp || new Date().toISOString(),
      userId: memory.userId,
      // 可选字段
      summary: memory.summary,
      keywords: memory.keywords,
      embedding: memory.embedding
    };

    // 调用Python服务保存记忆
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def save_memory():
    # 保存记忆
    await learning_memory_service.save_memory(
        ${memoryToSave.userId}, 
        """${memoryToSave.content.replace(/"/g, '\\"')}""", 
        "${memoryToSave.type}"
    )
    # 成功标志
    print("MEMORY_SAVED_SUCCESSFULLY")

asyncio.run(save_memory())
    `]);

    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0 || !output.includes('MEMORY_SAVED_SUCCESSFULLY')) {
          log(`[memoryStore] 保存记忆失败，Python进程退出码: ${code}`);
          reject(new Error('保存记忆失败'));
        } else {
          // 生成ID（通常文件名会作为ID）
          const id = `memory_${Date.now()}`;
          log(`[memoryStore] 记忆保存成功，ID: ${id}`);

          // 返回完整的记忆对象，包括生成的ID
          resolve({
            ...memoryToSave,
            id
          } as Memory);
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        log(`[memoryStore] Python错误: ${data}`);
      });

      pythonProcess.on('error', (error) => {
        log(`[memoryStore] 启动Python进程失败: ${error}`);
        reject(error);
      });
    });
  } catch (error) {
    log(`[memoryStore] 保存记忆时遇到错误: ${error}`);
    throw error;
  }
}

/**
 * 获取指定ID的记忆
 * 
 * @param id 记忆ID
 * @param userId 用户ID（用于验证权限）
 * @returns 记忆对象，如果不存在则返回null
 */
export async function getMemoryById(id: string, userId?: number): Promise<Memory | null> {
  try {
    // 这个实现依赖于文件系统，需要扫描用户目录
    if (!userId) {
      throw new Error('必须提供用户ID');
    }

    const userDir = path.join(MEMORY_DIR, userId.toString());
    if (!fs.existsSync(userDir)) {
      return null;
    }

    // 查找匹配ID的文件（ID可能是文件名的一部分）
    const files = fs.readdirSync(userDir).filter(file => 
      file.endsWith('.json') && (file === `${id}.json` || file.includes(id))
    );

    if (files.length === 0) {
      return null;
    }

    // 读取文件内容
    const filePath = path.join(userDir, files[0]);
    const content = fs.readFileSync(filePath, 'utf8');
    const memoryData = JSON.parse(content);

    // 确保数据格式正确
    return {
      id: files[0].replace('.json', ''),
      content: memoryData.content,
      type: memoryData.type || 'chat',
      timestamp: memoryData.timestamp,
      userId,
      summary: memoryData.summary,
      keywords: memoryData.keywords,
      embedding: memoryData.embedding
    };
  } catch (error) {
    log(`[memoryStore] 获取记忆时遇到错误: ${error}`);
    return null;
  }
}

/**
 * 查找与给定文本相似的记忆
 * 
 * @param text 查询文本
 * @param userId 用户ID
 * @param options 相似度选项
 * @returns 相似记忆列表
 */
export async function findSimilarMemories(
  text: string,
  userId: number,
  options: SimilarityOptions = {}
): Promise<Memory[]> {
  try {
    const limit = options.limit || 5;

    log(`[memoryStore] 尝试查找相似记忆: 用户=${userId}, 查询=${text.substring(0, 50)}...`);

    // 调用Python服务检索相似记忆
    const pythonProcess = spawn('python3', ['-c', `
import asyncio
import sys
import json
sys.path.append('server')
from services.learning_memory import learning_memory_service

async def retrieve_memories():
    # 检索相似记忆
    memories = await learning_memory_service.retrieve_similar_memories(
        ${userId}, 
        """${text.replace(/"/g, '\\"')}""", 
        ${limit}
    )
    # 转换为JSON输出
    print(json.dumps(memories, ensure_ascii=False))

asyncio.run(retrieve_memories())
    `]);

    let output = '';
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          log(`[memoryStore] 检索相似记忆失败，Python进程退出码: ${code}`);
          resolve([]);
        } else {
          try {
            // 记录完整输出以便调试
            log(`[memoryStore] Python输出完整内容: ${output}`);
            
            // 尝试从明确标记的JSON结果中提取
            const resultMatch = output.match(/JSON_RESULT_BEGIN\n(.*)\nJSON_RESULT_END/s);
            let memories = [];

            if (resultMatch && resultMatch[1]) {
              try {
                memories = JSON.parse(resultMatch[1]) || [];
                log(`[memoryStore] 从标记的JSON区域成功提取数据`);
              } catch (e) {
                log(`[memoryStore] 从标记区域解析JSON失败: ${e}, 尝试其他方法`);
              }
            } 
            
            // 如果上面的方法失败或没有找到标记，尝试直接解析整个输出
            if (!memories.length) {
              try {
                // 首先尝试直接解析整个输出
                memories = JSON.parse(output.trim()) || [];
                log(`[memoryStore] 直接解析整个输出成功`);
              } catch (e) {
                log(`[memoryStore] 直接解析失败，尝试查找JSON对象或数组`);
                
                // 尝试找到输出中的JSON数组
                const arrayMatch = output.match(/(\[.*\])/s);
                if (arrayMatch && arrayMatch[0]) {
                  try {
                    memories = JSON.parse(arrayMatch[0]) || [];
                    log(`[memoryStore] 从输出中提取JSON数组成功`);
                  } catch (arrayError) {
                    log(`[memoryStore] 从输出中提取JSON数组失败: ${arrayError}`);
                  }
                }
                
                // 如果数组匹配失败，尝试提取所有JSON对象并组合成数组
                if (!memories.length) {
                  const objectMatches = [...output.matchAll(/(\{[^{}]*\})/g)];
                  if (objectMatches.length > 0) {
                    try {
                      // 尝试解析每个匹配的对象
                      memories = objectMatches.map(match => JSON.parse(match[0])).filter(Boolean);
                      log(`[memoryStore] 从输出中提取多个JSON对象成功: ${memories.length}个`);
                    } catch (objError) {
                      log(`[memoryStore] 从输出中提取JSON对象失败: ${objError}`);
                    }
                  } else {
                    log(`[memoryStore] 无法识别JSON数据，输出: ${output.substring(0, 200)}...`);
                  }
                }
              }
            }

            // 确保每个记忆对象都有正确的字段
            const formattedMemories = memories.map((memory: any) => ({
              id: memory.id || `memory_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              content: memory.content,
              type: memory.type || 'chat',
              timestamp: memory.timestamp || new Date().toISOString(),
              userId,
              summary: memory.summary,
              keywords: memory.keywords,
              embedding: memory.embedding
            }));

            resolve(formattedMemories);
          } catch (error) {
            log(`[memoryStore] 解析相似记忆结果失败: ${error}`);
            log(`[memoryStore] 原始输出: ${output}`);
            // 在错误情况下返回空数组而不是抛出异常
            resolve([]);
          }
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        log(`[memoryStore] Python错误: ${data}`);
      });

      pythonProcess.on('error', (error) => {
        log(`[memoryStore] 启动Python进程失败: ${error}`);
        resolve([]);
      });
    });
  } catch (error) {
    log(`[memoryStore] 检索相似记忆时遇到错误: ${error}`);
    return [];
  }
}

/**
 * 按条件筛选记忆
 * 
 * @param filter 过滤条件
 * @returns 符合条件的记忆列表
 */
export async function getMemoriesByFilter(filter: MemoryFilter): Promise<Memory[]> {
  try {
    const { userId, types, startDate, endDate, keywords } = filter;

    if (!userId) {
      throw new Error('必须提供用户ID');
    }

    const userDir = path.join(MEMORY_DIR, userId.toString());
    if (!fs.existsSync(userDir)) {
      return [];
    }

    // 读取用户目录下所有记忆文件
    const files = fs.readdirSync(userDir).filter(file => file.endsWith('.json'));
    const memories: Memory[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(userDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const memoryData = JSON.parse(content);

        // 应用过滤条件
        if (
          (!types || types.includes(memoryData.type)) &&
          (!startDate || new Date(memoryData.timestamp) >= startDate) &&
          (!endDate || new Date(memoryData.timestamp) <= endDate) &&
          (!keywords || (
            memoryData.keywords && 
            memoryData.keywords.some((k: string) => keywords.includes(k))
          ))
        ) {
          memories.push({
            id: file.replace('.json', ''),
            content: memoryData.content,
            type: memoryData.type || 'chat',
            timestamp: memoryData.timestamp,
            userId,
            summary: memoryData.summary,
            keywords: memoryData.keywords,
            embedding: memoryData.embedding
          });
        }
      } catch (error) {
        // 跳过读取失败的文件
        log(`[memoryStore] 读取记忆文件失败: ${file}, 错误: ${error}`);
      }
    }

    return memories;
  } catch (error) {
    log(`[memoryStore] 筛选记忆时遇到错误: ${error}`);
    return [];
  }
}

/**
 * 更新记忆的摘要和关键词
 * 
 * @param memoryId 记忆ID
 * @param userId 用户ID
 * @param summary 新的摘要
 * @param keywords 新的关键词列表
 * @returns 是否更新成功
 */
export async function updateMemorySummary(
  memoryId: string,
  userId: number,
  summary: string,
  keywords?: string[]
): Promise<boolean> {
  try {
    // 获取记忆对象
    const memory = await getMemoryById(memoryId, userId);
    if (!memory) {
      return false;
    }

    // 更新字段
    memory.summary = summary;
    if (keywords) {
      memory.keywords = keywords;
    }

    // 获取文件路径
    const userDir = path.join(MEMORY_DIR, userId.toString());
    const filePath = path.join(userDir, `${memoryId}.json`);

    // 如果文件不存在，尝试查找匹配的文件
    if (!fs.existsSync(filePath)) {
      const files = fs.readdirSync(userDir).filter(file => 
        file.endsWith('.json') && (file === `${memoryId}.json` || file.includes(memoryId))
      );

      if (files.length === 0) {
        return false;
      }

      const actualFilePath = path.join(userDir, files[0]);
      fs.writeFileSync(actualFilePath, JSON.stringify(memory, null, 2), 'utf8');
    } else {
      // 直接写入文件
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2), 'utf8');
    }

    return true;
  } catch (error) {
    log(`[memoryStore] 更新记忆摘要时遇到错误: ${error}`);
    return false;
  }
}