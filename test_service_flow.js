/**
 * 主服务流程测试脚本
 * 测试完整记忆流程：创建记忆 -> 向量嵌入 -> 聚类 -> 主题生成
 */

import { db } from './server/db.js';
import { storage } from './server/storage.js';
import { genAiService } from './server/services/genai/genai_service.js';
import { memorySummarizer } from './server/services/learning/memory_summarizer.js';
import { clusterCacheService } from './server/services/learning/cluster_cache_service.js';

/**
 * 打印带颜色的日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m' // 红色
  };
  
  const reset = '\x1b[0m';
  console.log(`${colors[type] || colors.info}[${type.toUpperCase()}] ${message}${reset}`);
}

/**
 * 生成测试用的时间戳ID
 */
function generateTimestampId() {
  return Date.now().toString();
}

/**
 * 创建测试记忆
 */
async function createTestMemories(userId) {
  log(`开始为用户${userId}创建测试记忆...`);
  
  // 测试用记忆内容 - 减少为两条，加快测试速度
  const testMemories = [
    {
      content: `用户问: 量子计算的基本原理是什么？\n\nAI回答: 量子计算基于量子力学原理，利用量子比特（qubit）进行信息处理。与经典计算机使用的二进制位（0或1）不同，量子比特可以处于0、1的叠加态。这种叠加态使量子计算机可以同时处理多个计算路径，而量子纠缠则允许量子比特之间产生强相关性。量子计算的其他关键原理包括量子干涉和量子测量。`,
      type: 'chat'
    },
    {
      content: `用户问: 量子计算与经典计算的主要区别是什么？\n\nAI回答: 量子计算与经典计算的主要区别：1)基本单元：量子计算使用量子比特(qubit)，可以同时表示0和1；经典计算使用二进制位，只能是0或1。2)信息处理：量子计算利用叠加态和纠缠效应并行处理大量信息；经典计算只能顺序处理信息。3)运算能力：量子计算在特定问题上呈指数级加速；经典计算在这些问题上需要指数级时间。4)稳定性：量子计算受退相干影响，需要极低温环境；经典计算较为稳定。5)应用场景：两者各有优势，未来可能是混合计算架构。`,
      type: 'chat'
    }
  ];
  
  const memoryIds = [];
  
  // 创建记忆
  for (const memory of testMemories) {
    try {
      // 直接使用storage.createMemory的正确参数格式，确保userId是数字类型
      const newMemory = await storage.createMemory(
        Number(userId),        // 确保用户ID是数字类型
        memory.content,        // 内容
        memory.type,           // 类型
        undefined,             // 摘要（暂不提供，后续会生成）
        new Date()             // 时间戳
      );
      
      log(`成功创建记忆: ${newMemory.id.substring(0, 8)}...`, 'success');
      memoryIds.push(newMemory.id);
      
      // 等待一下，避免创建太快
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      log(`创建记忆失败: ${error}`, 'error');
    }
  }
  
  log(`成功创建了${memoryIds.length}条测试记忆`, 'success');
  return memoryIds;
}

/**
 * 生成摘要和向量嵌入
 */
async function generateSummariesAndEmbeddings(memoryIds) {
  log(`开始为${memoryIds.length}条记忆生成摘要和向量嵌入...`);
  
  for (const memoryId of memoryIds) {
    try {
      // 获取记忆内容
      const memory = await storage.getMemoryById(memoryId);
      
      if (!memory) {
        log(`找不到记忆: ${memoryId}`, 'error');
        continue;
      }
      
      // 生成摘要
      log(`为记忆${memoryId.substring(0, 8)}...生成摘要`);
      try {
        const summary = await memorySummarizer.summarizeText(memory.content);
        if (summary) {
          await storage.updateMemory(memoryId, undefined, summary);
          log(`已添加摘要: ${summary.substring(0, 30)}...`, 'success');
        }
      } catch (error) {
        log(`摘要生成失败: ${error}`, 'error');
      }
      
      // 生成向量嵌入
      log(`为记忆${memoryId.substring(0, 8)}...生成向量嵌入`);
      try {
        // 先检查是否已有嵌入
        const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryId);
        if (existingEmbedding) {
          log(`已有向量嵌入，跳过生成`, 'info');
          continue;
        }
        
        // 使用记忆摘要或内容生成向量
        const textForEmbedding = memory.summary || memory.content;
        const embedding = await genAiService.generateEmbedding(textForEmbedding);
        
        if (!embedding) {
          log(`向量生成失败，无返回结果`, 'error');
          continue;
        }
        
        // 保存向量
        await storage.saveMemoryEmbedding(memoryId, embedding);
        
        log(`成功生成${embedding.length}维向量嵌入`, 'success');
      } catch (error) {
        log(`向量嵌入生成失败: ${error}`, 'error');
      }
      
      // 等待一下，避免调用API太快
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      log(`处理记忆${memoryId}时出错: ${error}`, 'error');
    }
  }
  
  log(`完成摘要和向量嵌入生成`, 'success');
}

/**
 * 执行聚类和主题生成
 */
async function performClustering(userId) {
  log(`开始为用户${userId}执行聚类和主题生成...`);
  
  try {
    // 强制刷新聚类结果
    const clusterResults = await clusterCacheService.getUserClusterResults(userId, true);
    
    if (!clusterResults || Object.keys(clusterResults).length === 0) {
      log(`聚类结果为空`, 'warn');
      return;
    }
    
    log(`成功获取聚类结果，包含${Object.keys(clusterResults).length}个聚类`, 'success');
    
    // 输出聚类信息
    for (const [clusterId, cluster] of Object.entries(clusterResults)) {
      log(`聚类 ${clusterId}:`, 'info');
      log(`  主题: ${cluster.topic || '无'}`, cluster.topic ? 'success' : 'warn');
      log(`  记忆数量: ${(cluster.memory_ids || []).length}`);
      
      if (cluster.keywords && cluster.keywords.length > 0) {
        log(`  关键词: ${cluster.keywords.join(', ')}`);
      }
      
      if (cluster.summary) {
        log(`  摘要: ${cluster.summary.substring(0, 100)}...`);
      }
    }
  } catch (error) {
    log(`聚类执行失败: ${error}`, 'error');
  }
}

/**
 * 清除测试数据
 */
async function cleanupTestData(userId, memoryIds) {
  if (!memoryIds || memoryIds.length === 0) {
    return;
  }
  
  log(`清理测试用户${userId}的数据...`);
  
  // 删除向量嵌入
  for (const memoryId of memoryIds) {
    try {
      await db.delete('embeddings').where('memory_id', '=', memoryId).execute();
    } catch (error) {
      log(`删除记忆${memoryId}的向量嵌入失败: ${error}`, 'warn');
    }
  }
  
  // 删除聚类缓存
  try {
    await db.delete('cluster_cache').where('user_id', '=', userId).execute();
  } catch (error) {
    log(`删除用户${userId}的聚类缓存失败: ${error}`, 'warn');
  }
  
  // 删除记忆
  for (const memoryId of memoryIds) {
    try {
      await storage.deleteMemory(memoryId);
    } catch (error) {
      log(`删除记忆${memoryId}失败: ${error}`, 'warn');
    }
  }
  
  log(`测试数据清理完成`, 'success');
}

/**
 * 检查用户是否存在，不存在则创建
 */
async function ensureUserExists(userId) {
  try {
    // 检查用户是否存在
    const user = await storage.getUser(userId);
    
    if (user) {
      log(`用户${userId}已存在，ID: ${user.id}`, 'success');
      return true;
    }
    
    // 创建新用户
    log(`用户${userId}不存在，创建新用户...`);
    
    // 查询一个现有用户作为模板
    const [existingUser] = await db.select().from('users').limit(1).execute();
    
    if (!existingUser) {
      log('找不到任何现有用户作为模板', 'error');
      return false;
    }
    
    // 创建新用户
    const newUser = await storage.createUser({
      id: userId,
      username: `test_user_${userId}`,
      password: 'password', // 测试用途，实际应该使用哈希密码
      name: `Test User ${userId}`,
      email: `test${userId}@example.com`,
      createdAt: new Date()
    });
    
    log(`创建用户成功：${newUser.id}`, 'success');
    return true;
  } catch (error) {
    log(`确保用户存在时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  try {
    log('=== 开始主服务流程测试 ===', 'info');
    
    // 使用现有用户ID
    const testUserId = 15; // 使用系统中已有的用户ID
    let memoryIds = [];
    
    try {
      // 确保用户存在
      const userExists = await ensureUserExists(testUserId);
      if (!userExists) {
        log('无法确保测试用户存在，终止测试', 'error');
        return;
      }
      
      // 步骤1: 创建测试记忆
      memoryIds = await createTestMemories(testUserId);
      if (memoryIds.length === 0) {
        log('创建测试记忆失败，终止测试', 'error');
        return;
      }
      
      // 步骤2: 生成摘要和向量嵌入
      await generateSummariesAndEmbeddings(memoryIds);
      
      // 步骤3: 执行聚类和主题生成
      await performClustering(testUserId);
      
      log('=== 测试完成 ===', 'success');
    } finally {
      // 测试完成后清理数据
      if (memoryIds.length > 0) {
        await cleanupTestData(testUserId, memoryIds);
      }
    }
  } catch (error) {
    log(`测试执行出错: ${error}`, 'error');
  }
}

// 执行测试
main();