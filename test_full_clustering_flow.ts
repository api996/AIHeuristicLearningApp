/**
 * 完整聚类流程测试脚本
 * 测试从Python聚类->主题生成->数据库缓存的完整流程
 */

import { storage } from './server/storage';
import { directPythonService, VectorData } from './server/services/learning/direct_python_service';
import { clusterCacheService } from './server/services/learning/cluster_cache_service';

// 彩色日志输出
function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  console.log(colors[type], message);
}

/**
 * 生成测试向量
 */
function generateTestVectors(count: number, dimension: number): VectorData[] {
  const vectors: VectorData[] = [];
  
  // 模拟3个不同的主题聚类
  const topics = ['人工智能', '编程语言', '数据结构'];
  
  // 为每个主题创建一个基础向量
  const baseVectors = topics.map(() => 
    Array(dimension).fill(0).map(() => Math.random() * 2 - 1)
  );
  
  // 围绕主题基础向量生成记忆向量
  for (let i = 0; i < count; i++) {
    const topicIndex = i % topics.length;
    const baseVector = baseVectors[topicIndex];
    
    // 添加一些随机偏移，但保持向量整体偏向基础向量
    const vector = baseVector.map(v => v + (Math.random() * 0.2 - 0.1));
    
    vectors.push({
      id: `test_memory_${i}_${Date.now()}`,
      vector
    });
  }
  
  return vectors;
}

/**
 * 创建测试用的记忆数据
 */
async function createTestMemories(userId: number, count: number = 20) {
  colorLog(`为用户 ${userId} 创建 ${count} 条测试记忆...`, 'info');
  
  const memories = [];
  
  // 创建三组不同主题的记忆
  const topics = [
    {
      name: '人工智能',
      contents: [
        '我们讨论了人工智能的基础概念，包括机器学习和深度学习的区别',
        '神经网络模型在计算机视觉领域的应用非常广泛',
        '大语言模型通过自监督学习在大规模语料上训练得到',
        '人工智能伦理问题需要更多关注，尤其是算法偏见和隐私保护',
        '强化学习是让AI系统学习决策过程的重要方法',
        '生成式对抗网络可以创建高质量的图像和视频内容',
        '图卷积网络在处理图结构数据方面表现优异'
      ]
    },
    {
      name: '编程语言',
      contents: [
        'JavaScript是前端开发的核心语言，配合HTML和CSS使用',
        'Python的简洁语法和丰富库使其成为数据科学的流行选择',
        'TypeScript为JavaScript添加了静态类型检查功能',
        'Rust语言强调内存安全和高性能并发',
        'Go语言设计简洁，适合构建微服务和云原生应用',
        'Swift是Apple平台上主要的开发语言',
        'Kotlin已成为Android开发的官方推荐语言'
      ]
    },
    {
      name: '数据结构',
      contents: [
        '数组是最基本的数据结构，支持随机访问元素',
        '链表适合频繁插入和删除操作的场景',
        '树结构在表示层次关系数据时非常有用',
        '图数据结构可以表示复杂的关系网络',
        '哈希表提供快速的键值对查找能力',
        '栈和队列是遵循特定访问顺序的线性数据结构',
        '优先队列在调度算法中有广泛应用'
      ]
    }
  ];
  
  // 生成记忆ID
  const generateId = () => `test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  
  // 为每个主题创建记忆
  for (let i = 0; i < count; i++) {
    const topicIndex = i % topics.length;
    const topic = topics[topicIndex];
    const contentIndex = i % topic.contents.length;
    
    const memoryId = generateId();
    memories.push({
      id: memoryId,
      content: topic.contents[contentIndex],
      topic: topic.name, // 这个字段仅用于测试验证，实际中应由聚类生成
      userId
    });
  }
  
  // 创建记忆
  for (const memory of memories) {
    try {
      await storage.createMemory({
        id: memory.id,
        userId: memory.userId,
        content: memory.content,
        type: 'chat',
        timestamp: new Date(),
        summary: `关于${memory.topic}的讨论`, // 添加一个总结
        createdAt: new Date()
      });
      
      colorLog(`创建记忆: ${memory.id} (${memory.topic})`, 'info');
      
      // 生成向量
      const vector = Array(3072).fill(0).map(() => Math.random() * 2 - 1);
      
      // 保存向量
      await storage.saveMemoryEmbedding({
        memoryId: memory.id,
        vectorData: vector
      });
      
      colorLog(`保存记忆向量: ${memory.id}`, 'info');
    } catch (error) {
      colorLog(`创建记忆失败: ${error}`, 'error');
    }
  }
  
  return memories.map(m => m.id);
}

/**
 * 测试完整聚类流程
 */
async function testFullClusteringFlow(userId: number) {
  try {
    colorLog(`开始为用户 ${userId} 测试完整聚类流程...`, 'info');
    
    // 1. 清理现有的聚类缓存
    colorLog('1. 清理现有的聚类缓存...', 'info');
    await clusterCacheService.clearUserClusterCache(userId);
    colorLog(`已清理用户 ${userId} 的聚类缓存`, 'success');
    
    // 2. 创建测试记忆
    colorLog('2. 创建测试记忆数据...', 'info');
    const memoryIds = await createTestMemories(userId, 21);
    colorLog(`成功创建 ${memoryIds.length} 条测试记忆`, 'success');
    
    // 3. 强制执行用户聚类
    colorLog('3. 强制执行用户聚类...', 'info');
    const clusterResults = await clusterCacheService.getUserClusterResults(userId, true);
    
    // 4. 检查聚类结果
    colorLog('4. 检查聚类结果...', 'info');
    const clusterCount = Object.keys(clusterResults).length;
    colorLog(`获得 ${clusterCount} 个聚类`, clusterCount > 0 ? 'success' : 'error');
    
    if (clusterCount > 0) {
      // 显示聚类主题
      colorLog('聚类主题:', 'info');
      for (const [clusterId, cluster] of Object.entries(clusterResults)) {
        const c = cluster as any;
        const memCount = c.memory_ids?.length || 0;
        colorLog(`- ${clusterId}: "${c.topic}" (${memCount}条记忆)`, 'info');
      }
      
      // 获取缓存记录
      const cacheRecord = await storage.getClusterResultCache(userId);
      if (cacheRecord) {
        colorLog(`聚类结果已成功缓存，ID: ${cacheRecord.id}，版本: ${cacheRecord.version}`, 'success');
      } else {
        colorLog('缓存记录未找到', 'error');
      }
    }
    
    return clusterCount > 0;
  } catch (error) {
    colorLog(`测试聚类流程失败: ${error}`, 'error');
    console.error(error);
    return false;
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData(userId: number) {
  try {
    colorLog(`清理用户 ${userId} 的测试数据...`, 'info');
    
    // 获取用户记忆
    const memories = await storage.getMemoriesByUserId(userId);
    const testMemories = memories.filter(m => m.id.startsWith('test_'));
    
    // 删除测试记忆
    for (const memory of testMemories) {
      try {
        // 删除向量嵌入
        await storage.deleteMemoryEmbedding(memory.id);
        // 删除记忆
        await storage.deleteMemory(memory.id);
        colorLog(`删除测试记忆: ${memory.id}`, 'info');
      } catch (error) {
        colorLog(`删除记忆失败: ${error}`, 'warn');
      }
    }
    
    // 清理聚类缓存
    await clusterCacheService.clearUserClusterCache(userId);
    
    colorLog(`成功清理 ${testMemories.length} 条测试记忆和聚类缓存`, 'success');
    return true;
  } catch (error) {
    colorLog(`清理测试数据失败: ${error}`, 'error');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const testUserId = 6; // 使用ID为6的用户进行测试
    
    // 运行完整聚类流程测试
    const success = await testFullClusteringFlow(testUserId);
    
    // 询问是否保留测试数据
    const keepData = process.argv.includes('--keep-data');
    
    // 如果不保留数据，清理测试数据
    if (!keepData) {
      await cleanupTestData(testUserId);
      colorLog('测试数据已清理', 'info');
    } else {
      colorLog('保留测试数据，跳过清理步骤', 'info');
    }
    
    if (success) {
      colorLog('聚类流程测试完成，结果: 成功', 'success');
      process.exit(0);
    } else {
      colorLog('聚类流程测试完成，结果: 失败', 'error');
      process.exit(1);
    }
  } catch (error) {
    colorLog(`测试过程中发生错误: ${error}`, 'error');
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});