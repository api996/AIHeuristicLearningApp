/**
 * 完整流程测试脚本
 * 测试从创建记忆->向量化->聚类->主题生成的完整流程
 */

import { log } from './server/vite.js';
import { storage } from './server/storage.js';
import { genAiService } from './server/services/genai/genai_service.js';
import { memorySummarizer } from './server/services/learning/memory_summarizer.js';
import { clusterCacheService } from './server/services/learning/cluster_cache_service.js';
import { optimizedEmbeddingsService } from './server/services/embedding/optimized_embeddings.js';

/**
 * 打印带颜色的日志
 * @param {string} message 消息文本
 * @param {string} type 消息类型
 */
function printLog(message, type = 'info') {
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
 * 生成随机ID
 * @returns {string} 时间戳ID
 */
function generateTimestampId() {
  return Date.now().toString();
}

/**
 * 创建测试用户的记忆数据
 * @param {number} userId 用户ID
 * @returns {Promise<Array>} 创建的记忆ID列表
 */
async function createTestMemories(userId) {
  printLog(`开始为用户${userId}创建测试记忆...`);
  
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
    },
    {
      content: `用户问: 什么是量子比特？它与传统比特有何不同？\n\nAI回答: 量子比特(qubit)是量子计算的基本单位，与传统比特不同在于：1)状态表示：传统比特只能是0或1，而量子比特可以处于0和1的任意叠加态，用|ψ⟩ = α|0⟩ + β|1⟩表示，其中|α|²+|β|²=1；2)信息容量：n个传统比特可表示2^n个状态中的一个，而n个量子比特可同时表示2^n个状态的叠加；3)测量特性：传统比特测量不改变其状态，而量子比特测量将导致态坍缩到|0⟩或|1⟩；4)复数振幅：量子比特状态由复数振幅α和β决定，包含相位信息；5)纠缠能力：多个量子比特可形成纠缠态，实现经典比特无法实现的计算。`,
      type: 'chat'
    }
  ];
  
  const createdMemoryIds = [];
  
  // 为每个测试记忆创建数据库记录
  for (const memory of testMemories) {
    try {
      const timestamp = new Date();
      const id = generateTimestampId();
      
      // 创建记忆
      await storage.createMemory({
        id,
        userId,
        content: memory.content,
        type: memory.type,
        timestamp,
        createdAt: timestamp
      });
      
      printLog(`成功创建记忆: ${id.substring(0, 8)}...`, 'success');
      createdMemoryIds.push(id);
      
      // 生成记忆摘要
      try {
        const summary = await memorySummarizer.summarizeText(memory.content);
        if (summary) {
          await storage.updateMemorySummary(id, summary);
          printLog(`已为记忆${id.substring(0, 8)}...添加摘要：${summary.substring(0, 30)}...`);
        }
      } catch (summaryError) {
        printLog(`生成记忆摘要失败: ${summaryError}`, 'warn');
      }
      
      // 停顿一下，避免API限流
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      printLog(`创建记忆失败: ${error}`, 'error');
    }
  }
  
  printLog(`共成功创建${createdMemoryIds.length}条测试记忆`, 'success');
  return createdMemoryIds;
}

/**
 * 为记忆生成向量嵌入
 * @param {Array} memoryIds 记忆ID列表
 */
async function generateEmbeddings(memoryIds) {
  printLog(`开始为${memoryIds.length}条记忆生成向量嵌入...`);
  
  try {
    // 使用优化嵌入服务生成嵌入
    const count = await optimizedEmbeddingsService.processRemembersWithoutEmbeddings();
    printLog(`向量生成队列中有${count}条记忆待处理`);
    
    // 直接获取记忆内容并生成嵌入
    for (const memoryId of memoryIds) {
      try {
        const memory = await storage.getMemoryById(memoryId);
        if (!memory) {
          printLog(`找不到记忆: ${memoryId}`, 'warn');
          continue;
        }
        
        // 检查是否已有嵌入
        const existingEmbedding = await storage.getEmbeddingByMemoryId(memoryId);
        if (existingEmbedding) {
          printLog(`记忆${memoryId.substring(0, 8)}...已有嵌入向量`);
          continue;
        }
        
        // 生成嵌入
        const text = memory.summary || memory.content;
        const embedding = await genAiService.generateEmbedding(text);
        
        if (!embedding) {
          printLog(`无法为记忆${memoryId.substring(0, 8)}...生成嵌入向量`, 'warn');
          continue;
        }
        
        // 保存嵌入向量
        await storage.createEmbedding({
          memoryId,
          vectorData: embedding
        });
        
        printLog(`成功为记忆${memoryId.substring(0, 8)}...生成嵌入向量(维度: ${embedding.length})`, 'success');
        
        // 停顿一下，避免API限流
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        printLog(`处理记忆${memoryId}嵌入时出错: ${error}`, 'error');
      }
    }
    
    printLog(`完成向量嵌入生成`, 'success');
  } catch (error) {
    printLog(`生成向量嵌入时出错: ${error}`, 'error');
  }
}

/**
 * 测试聚类和主题生成
 * @param {number} userId 用户ID
 */
async function testClustering(userId) {
  printLog(`开始为用户${userId}测试聚类和主题生成...`);
  
  try {
    // 强制刷新聚类
    const clusterResults = await clusterCacheService.getUserClusterResults(userId, true);
    
    if (!clusterResults || Object.keys(clusterResults).length === 0) {
      printLog(`聚类结果为空`, 'warn');
      return false;
    }
    
    printLog(`成功获取聚类结果，包含${Object.keys(clusterResults).length}个聚类`, 'success');
    
    // 打印聚类信息
    for (const [clusterId, cluster] of Object.entries(clusterResults)) {
      printLog(`聚类${clusterId}: 主题="${cluster.topic || '无'}"，包含${(cluster.memory_ids || []).length}条记忆`);
      if (cluster.keywords && cluster.keywords.length > 0) {
        printLog(`  关键词: ${cluster.keywords.join(', ')}`);
      }
    }
    
    return true;
  } catch (error) {
    printLog(`测试聚类失败: ${error}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function main() {
  try {
    printLog('=== 开始完整流程测试 ===', 'info');
    
    // 测试用户ID
    const testUserId = 99; // 使用测试用户ID以避免影响正常用户数据
    
    // 步骤1: 创建测试记忆
    const memoryIds = await createTestMemories(testUserId);
    if (memoryIds.length === 0) {
      printLog('创建测试记忆失败，终止测试', 'error');
      return;
    }
    
    // 步骤2: 生成向量嵌入
    await generateEmbeddings(memoryIds);
    
    // 步骤3: 测试聚类和主题生成
    const clusteringSuccess = await testClustering(testUserId);
    
    // 测试结果汇总
    printLog('=== 测试结果汇总 ===', 'info');
    printLog(`1. 记忆创建: ${memoryIds.length > 0 ? '成功' : '失败'}`, memoryIds.length > 0 ? 'success' : 'error');
    printLog(`2. 向量生成: ${memoryIds.length > 0 ? '已尝试' : '跳过'}`, memoryIds.length > 0 ? 'success' : 'warn');
    printLog(`3. 聚类分析: ${clusteringSuccess ? '成功' : '失败'}`, clusteringSuccess ? 'success' : 'error');
    
    printLog('测试完成!', 'success');
  } catch (error) {
    printLog(`测试过程中发生错误: ${error}`, 'error');
  }
}

// 执行测试
main();