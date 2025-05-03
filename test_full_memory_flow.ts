/**
 * 完整记忆流程测试脚本
 * 测试从创建记忆->向量化->聚类缓存->学习轨迹生成->主题图谱的完整流程
 */

import { log } from './server/vite';
import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';
import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { generateUserKnowledgeGraph } from './server/services/learning/knowledge_graph';
import path from 'path';
import fs from 'fs';

// 使用已存在的用户ID
const TEST_USER_ID = 15; // testuser

// 测试记忆内容 - 使用不同主题的内容创建清晰的聚类
const TEST_MEMORIES = [
  // 机器学习主题
  { 
    content: "机器学习算法可以分为监督学习、无监督学习和强化学习三大类。监督学习需要标记数据，而无监督学习则不需要。强化学习是通过与环境交互来学习的一种方法。",
    type: "chat"
  },
  { 
    content: "深度学习是机器学习的一个子领域，它使用多层神经网络来模拟人脑的工作方式。常见的深度学习架构包括CNN（卷积神经网络）、RNN（循环神经网络）和Transformer等。",
    type: "chat"
  },
  { 
    content: "迁移学习是将在一个任务上训练好的模型，应用到另一个相关任务上的技术。它可以有效解决数据不足或训练资源有限的问题。预训练模型如BERT、GPT就是基于这一思想。",
    type: "chat"
  },
  
  // 编程语言主题
  { 
    content: "Python是一种高级编程语言，以其简洁易读的语法和丰富的库生态系统而著名。它被广泛应用于数据科学、Web开发和自动化等领域。",
    type: "chat"
  },
  { 
    content: "JavaScript是Web开发的核心语言之一，它允许开发者为网页添加交互功能。随着Node.js的出现，JavaScript也可以用于服务器端开发。",
    type: "chat"
  },
  { 
    content: "TypeScript是JavaScript的超集，它添加了静态类型检查功能。这使得开发大型应用程序时更容易维护和调试代码，减少了运行时错误。",
    type: "chat"
  },
  
  // 数据库主题
  { 
    content: "关系型数据库如MySQL和PostgreSQL使用结构化查询语言(SQL)来管理数据。它们适合需要复杂查询和事务的应用场景。",
    type: "chat"
  },
  { 
    content: "NoSQL数据库如MongoDB和Redis不使用传统的表结构，而是采用文档、键值对或图等结构来存储数据。它们通常更适合处理大规模和非结构化数据。",
    type: "chat"
  },
  { 
    content: "数据库索引是提高查询性能的重要机制。索引可以减少数据库需要扫描的记录数量，但会增加写入操作的开销和存储空间的使用。",
    type: "chat"
  }
];

/**
 * 打印带颜色的日志
 */
function printLog(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const colorMap = {
    info: '\x1b[36m',    // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m',   // 红色
  };
  
  const resetColor = '\x1b[0m';
  console.log(`${colorMap[type]}[${type.toUpperCase()}] ${message}${resetColor}`);
}

/**
 * 创建测试用的3072维向量
 * 为了使聚类有意义，我们为相同主题的记忆创建相似的向量
 */
function generateTestVector(themeIndex: number): number[] {
  const vector = Array(3072).fill(0).map(() => (Math.random() - 0.5) * 0.01);
  
  // 为每个主题在特定维度上设置特征值，使得相同主题的记忆向量相似
  // 主题1: 机器学习 (前1000个维度有更高的值)
  // 主题2: 编程语言 (中间1000个维度有更高的值)
  // 主题3: 数据库 (后1000个维度有更高的值)
  const themeOffset = themeIndex * 1000;
  
  for (let i = 0; i < 1000; i++) {
    vector[themeOffset + i] = Math.random() * 0.5 + 0.5; // 0.5-1.0之间的值
  }
  
  return vector;
}

/**
 * 清理测试用户的所有数据
 */
async function cleanupTestUser(): Promise<void> {
  try {
    printLog(`清理测试用户(ID=${TEST_USER_ID})的所有数据...`, 'info');
    
    // 删除聚类缓存
    await storage.clearClusterResultCache(TEST_USER_ID);
    
    // 删除知识图谱缓存
    await storage.clearKnowledgeGraphCache(TEST_USER_ID);
    
    // 删除用户的所有记忆
    const memories = await storage.getMemoriesByUserId(TEST_USER_ID);
    for (const memory of memories) {
      await storage.deleteMemory(memory.id);
    }
    
    printLog(`成功清理测试用户的所有数据`, 'success');
  } catch (error) {
    printLog(`清理测试用户数据时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 为测试用户创建记忆和向量嵌入
 */
async function createTestMemories(): Promise<string[]> {
  try {
    printLog(`为测试用户(ID=${TEST_USER_ID})创建测试记忆...`, 'info');
    
    const memoryIds: string[] = [];
    
    // 为每条测试记忆创建记忆记录和向量嵌入
    for (let i = 0; i < TEST_MEMORIES.length; i++) {
      const memory = TEST_MEMORIES[i];
      const themeIndex = Math.floor(i / 3); // 每3条记忆属于同一主题
      
      // 1. 创建记忆
      printLog(`创建第${i+1}条测试记忆: ${memory.content.substring(0, 30)}...`, 'info');
      const createdMemory = await storage.createMemory(
        TEST_USER_ID,
        memory.content,
        memory.type,
        `摘要: ${memory.content.substring(0, 50)}...`
      );
      
      memoryIds.push(createdMemory.id);
      
      // 2. 为记忆添加关键词
      const keywords = memory.content
        .split(/[\s,.，。、；;]+/)
        .filter(word => word.length >= 2 && word.length <= 6)
        .slice(0, 5);
      
      for (const keyword of keywords) {
        await storage.addKeywordToMemory(createdMemory.id, keyword);
      }
      
      // 3. 为记忆创建向量嵌入
      const vector = generateTestVector(themeIndex);
      await storage.saveMemoryEmbedding(createdMemory.id, vector);
      
      printLog(`成功为记忆${createdMemory.id}创建向量嵌入(维度=${vector.length})`, 'success');
    }
    
    printLog(`成功创建${memoryIds.length}条测试记忆`, 'success');
    return memoryIds;
  } catch (error) {
    printLog(`创建测试记忆时出错: ${error}`, 'error');
    throw error;
  }
}

/**
 * 测试聚类缓存服务
 */
async function testClusterCache(): Promise<boolean> {
  try {
    printLog(`测试聚类缓存服务...`, 'info');
    
    // 1. 清除现有缓存
    await storage.clearClusterResultCache(TEST_USER_ID);
    printLog(`已清除现有聚类缓存`, 'info');
    
    // 2. 首次获取聚类结果(应执行实际聚类)
    const startTime1 = Date.now();
    const result1 = await clusterCacheService.getUserClusterResults(TEST_USER_ID);
    const duration1 = Date.now() - startTime1;
    
    const clusterCount1 = Object.keys(result1 || {}).length;
    printLog(`首次聚类完成，耗时=${duration1}ms，聚类数量=${clusterCount1}`, 'success');
    
    // 输出聚类结果详情
    if (clusterCount1 > 0) {
      for (const [clusterId, cluster] of Object.entries(result1)) {
        const clusterData = cluster as any;
        printLog(`  聚类${clusterId}: ${clusterData.topic || '无主题'}, ${clusterData.memory_ids?.length || 0}条记忆`, 'info');
        if (clusterData.keywords && clusterData.keywords.length > 0) {
          printLog(`    关键词: ${clusterData.keywords.join(', ')}`, 'info');
        }
      }
    }
    
    // 3. 再次获取聚类结果(应使用缓存)
    const startTime2 = Date.now();
    const result2 = await clusterCacheService.getUserClusterResults(TEST_USER_ID);
    const duration2 = Date.now() - startTime2;
    
    const clusterCount2 = Object.keys(result2 || {}).length;
    printLog(`二次聚类完成，耗时=${duration2}ms，聚类数量=${clusterCount2}`, 'success');
    
    // 检查缓存是否生效
    const cacheEffective = duration2 < duration1;
    if (cacheEffective) {
      printLog(`缓存有效: 第二次(${duration2}ms)比第一次(${duration1}ms)快`, 'success');
    } else {
      printLog(`缓存可能无效: 第二次(${duration2}ms)没有比第一次(${duration1}ms)快`, 'warning');
    }
    
    return clusterCount1 > 0 && cacheEffective;
  } catch (error) {
    printLog(`测试聚类缓存服务时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 测试与memory_service的集成
 */
async function testMemoryServiceIntegration(): Promise<boolean> {
  try {
    printLog(`测试与memory_service的集成...`, 'info');
    
    // 通过memory_service获取聚类结果
    const { clusterResult, clusterCount } = await memoryService.getUserClusters(TEST_USER_ID);
    
    printLog(`通过memory_service获取的聚类数量: ${clusterCount}`, 'info');
    
    if (clusterResult && clusterResult.centroids && clusterResult.centroids.length > 0) {
      // 输出聚类中心和点信息
      for (let i = 0; i < clusterResult.centroids.length; i++) {
        const centroid = clusterResult.centroids[i];
        printLog(`  聚类${i}: ${centroid.points.length}个点`, 'info');
      }
      
      return true;
    } else {
      printLog(`未能通过memory_service获取有效的聚类结果`, 'warning');
      return false;
    }
  } catch (error) {
    printLog(`测试memory_service集成时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 测试知识图谱生成
 */
async function testKnowledgeGraph(): Promise<boolean> {
  try {
    printLog(`测试知识图谱生成...`, 'info');
    
    // 生成知识图谱
    const startTime = Date.now();
    const graph = await generateUserKnowledgeGraph(TEST_USER_ID, true);
    const duration = Date.now() - startTime;
    
    printLog(`知识图谱生成完成，耗时=${duration}ms`, 'info');
    
    // 检查图谱节点和连接
    const nodeCount = graph.nodes.length;
    const linkCount = graph.links.length;
    
    printLog(`知识图谱包含${nodeCount}个节点和${linkCount}个连接`, 'info');
    
    // 输出一些节点信息
    if (nodeCount > 0) {
      printLog(`节点示例:`, 'info');
      for (let i = 0; i < Math.min(nodeCount, 5); i++) {
        printLog(`  ${graph.nodes[i].label} (类别: ${graph.nodes[i].category})`, 'info');
      }
    }
    
    return nodeCount > 0;
  } catch (error) {
    printLog(`测试知识图谱生成时出错: ${error}`, 'error');
    return false;
  }
}

/**
 * 保存测试结果到文件
 */
async function saveTestResults(results: any): Promise<void> {
  try {
    const resultsDir = path.join(process.cwd(), 'tmp');
    
    // 确保目录存在
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const resultsPath = path.join(resultsDir, `test_results_${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    printLog(`测试结果已保存到: ${resultsPath}`, 'success');
  } catch (error) {
    printLog(`保存测试结果时出错: ${error}`, 'error');
  }
}

/**
 * 主测试函数
 */
async function runFullTest(): Promise<void> {
  const testResults: any = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  try {
    // 1. 清理测试用户数据
    await cleanupTestUser();
    
    // 2. 创建测试记忆和向量嵌入
    const memoryIds = await createTestMemories();
    testResults.tests.createMemories = {
      success: memoryIds.length > 0,
      memoryCount: memoryIds.length
    };
    
    // 等待1秒，确保数据已写入
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. 测试聚类缓存服务
    const clusterCacheResult = await testClusterCache();
    testResults.tests.clusterCache = {
      success: clusterCacheResult
    };
    
    // 4. 测试与memory_service的集成
    const memoryServiceResult = await testMemoryServiceIntegration();
    testResults.tests.memoryService = {
      success: memoryServiceResult
    };
    
    // 5. 测试知识图谱生成
    const knowledgeGraphResult = await testKnowledgeGraph();
    testResults.tests.knowledgeGraph = {
      success: knowledgeGraphResult
    };
    
    // 汇总结果
    const allTestsPassed = 
      testResults.tests.createMemories.success &&
      testResults.tests.clusterCache.success &&
      testResults.tests.memoryService.success &&
      testResults.tests.knowledgeGraph.success;
    
    testResults.allTestsPassed = allTestsPassed;
    
    if (allTestsPassed) {
      printLog(`所有测试通过！完整记忆流程工作正常`, 'success');
    } else {
      printLog(`部分测试未通过，请检查详细结果`, 'warning');
    }
    
    // 保存测试结果
    await saveTestResults(testResults);
    
  } catch (error) {
    printLog(`测试执行出错: ${error}`, 'error');
    testResults.error = String(error);
    await saveTestResults(testResults);
  } finally {
    // 清理测试数据
    await cleanupTestUser();
  }
}

// 执行测试
runFullTest().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});