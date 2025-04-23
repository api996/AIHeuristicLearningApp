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
  
  // 测试用记忆内容
  const testMemories = [
    {
      content: `用户问: 量子计算的基本原理是什么？\n\nAI回答: 量子计算基于量子力学原理，利用量子比特（qubit）进行信息处理。与经典计算机使用的二进制位（0或1）不同，量子比特可以处于0、1的叠加态。这种叠加态使量子计算机可以同时处理多个计算路径，而量子纠缠则允许量子比特之间产生强相关性。量子计算的其他关键原理包括量子干涉和量子测量。`,
      type: 'chat'
    },
    {
      content: `用户问: 量子计算与经典计算的主要区别是什么？\n\nAI回答: 量子计算与经典计算的主要区别：1)基本单元：量子计算使用量子比特(qubit)，可以同时表示0和1；经典计算使用二进制位，只能是0或1。2)信息处理：量子计算利用叠加态和纠缠效应并行处理大量信息；经典计算只能顺序处理信息。3)运算能力：量子计算在特定问题上呈指数级加速；经典计算在这些问题上需要指数级时间。4)稳定性：量子计算受退相干影响，需要极低温环境；经典计算较为稳定。5)应用场景：两者各有优势，未来可能是混合计算架构。`,
      type: 'chat'
    },
    {
      content: `用户问: 什么是量子纠缠？\n\nAI回答: 量子纠缠是量子力学中的一种现象，指两个或多个量子粒子之间存在的一种特殊关联，使得它们的量子状态无法独立描述。当粒子处于纠缠状态时，测量一个粒子会立即影响另一个粒子的状态，即使它们相距很远。这种关联并非由经典物理可以解释的信号传递造成，而是量子力学的固有特性。爱因斯坦称之为"鬼魅般的超距作用"，但贝尔不等式和后续实验证明了量子纠缠的确实存在。量子纠缠是量子计算、量子密钥分发等量子技术的核心资源。`,
      type: 'chat'
    },
    {
      content: `用户问: 现实中的量子计算机是如何工作的？\n\nAI回答: 现实中的量子计算机工作原理：1)物理实现：通常使用超导量子比特、离子阱、光子或量子点技术。主流是超导量子比特，需在接近绝对零度环境运行。2)初始化：将量子比特设置到已知状态(通常为|0⟩)。3)量子门操作：应用单量子比特和双量子比特门操作，形成量子电路。4)读取结果：通过量子测量将量子态坍缩到经典态，获取计算结果。5)错误修正：实施量子纠错以抵抗退相干和噪声。6)经典控制：量子处理器与经典计算机配合，进行程序控制和结果分析。当前量子计算机仍有规模和错误率限制，处于早期发展阶段。`,
      type: 'chat'
    },
    {
      content: `用户问: 量子算法有哪些？它们解决什么问题？\n\nAI回答: 主要量子算法及其应用：1)Shor算法：用于大数分解，能破解RSA加密，指数级加速；2)Grover算法：提供平方级加速的无序数据库搜索；3)量子傅里叶变换：多种量子算法的基础；4)量子相位估计：估计酉算符特征值的相位，用于模拟量子系统；5)HHL算法：解线性方程组，适用于机器学习；6)VQE和QAOA：近期量子算法，解决优化问题；7)量子机器学习算法：包括量子支持向量机和量子神经网络；8)量子随机游走：用于图分析和搜索；9)量子模拟：模拟量子系统的行为。这些算法在密码学、优化、材料科学和药物发现等领域有巨大潜力。`,
      type: 'chat'
    }
  ];
  
  const memoryIds = [];
  
  // 创建记忆
  for (const memory of testMemories) {
    try {
      // 直接使用storage.createMemory的正确参数格式
      const newMemory = await storage.createMemory(
        userId,                // 用户ID (as number)
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
          await storage.updateMemorySummary(memoryId, summary);
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