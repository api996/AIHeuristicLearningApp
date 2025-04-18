/**
 * 记忆系统处理流程测试
 * 测试整个流程从创建记忆->聚类->知识图谱生成
 */

import { log } from "./server/vite.js";
import { memoryService } from "./server/services/learning/memory_service.js";
import { clusterMemoryRetrieval } from "./server/services/learning/cluster_memory_retrieval.js";
import { storage } from "./server/storage.js";
import { generateKnowledgeGraph } from "./server/services/learning/knowledge_graph.js";

// 设置测试用户ID
const TEST_USER_ID = 6;

// 测试数据 - 不同主题的记忆内容
const testMemories = [
  // 编程相关记忆
  "JavaScript是一种高级的、解释型的编程语言，是一门基于原型、函数先行的语言，最早是在客户端进行处理的语言",
  "React是一个用于构建用户界面的JavaScript库，由Facebook开发，React使用组件化思想，每个组件负责渲染页面的一部分",
  "Node.js是一个基于Chrome V8引擎的JavaScript运行环境，使得JavaScript可以在服务器端运行，执行I/O操作",
  "TypeScript是JavaScript的超集，添加了类型系统和对ES6+的支持，由Microsoft开发，广泛用于大型应用的开发",
  
  // 人工智能相关记忆
  "机器学习是人工智能的一个子集，它使用统计学方法，让计算机系统从数据中学习，而不需要明确编程每一个任务",
  "深度学习是机器学习的一个子集，它使用多层神经网络模拟人脑的结构和功能，可以从大量数据中学习特征和模式",
  "神经网络是一种模拟人脑神经元连接的算法模型，由输入层、隐藏层和输出层组成，可以进行复杂的模式识别和预测",
  "自然语言处理(NLP)是AI的一个分支，研究如何让计算机理解、解析和生成人类语言，常用于智能助手、翻译等应用",
  
  // 健康相关记忆
  "规律的体育锻炼可以增强免疫系统，减少慢性疾病风险，改善心理健康，提高生活质量",
  "均衡的饮食应包含各类营养素，如碳水化合物、蛋白质、健康脂肪、维生素和矿物质",
  "充足的睡眠对身体健康至关重要，成年人应保证每晚7-9小时的高质量睡眠",
  "压力管理技巧包括深呼吸、冥想、规律运动、保持社交联系和寻求专业支持"
];

// 测试主函数
async function runTest() {
  try {
    log("==== 开始测试记忆系统流程 ====");
    
    // 1. 保存测试记忆
    log("\n1. 保存测试记忆:");
    const createdMemories = await createTestMemories();
    
    if (createdMemories.length === 0) {
      log("创建测试记忆失败，退出测试", "error");
      return;
    }
    
    // 2. 测试基于聚类的记忆检索
    log("\n2. 测试基于聚类的记忆检索:");
    await testClusterMemoryRetrieval();
    
    // 3. 测试知识图谱生成
    log("\n3. 测试知识图谱生成:");
    await testKnowledgeGraphGeneration();
    
    log("\n==== 测试完成 ====");
  } catch (error) {
    log(`测试过程中出错: ${error}`, "error");
  }
}

// 创建测试记忆
async function createTestMemories() {
  const createdMemories = [];
  for (const content of testMemories) {
    try {
      log(`创建记忆: ${content.substring(0, 50)}...`);
      const memory = await memoryService.createMemory(TEST_USER_ID, content, "chat");
      
      if (memory) {
        log(`记忆创建成功，ID: ${memory.id}`, "success");
        createdMemories.push(memory);
      }
    } catch (error) {
      log(`创建记忆失败: ${error}`, "error");
    }
  }
  
  log(`成功创建 ${createdMemories.length} 条测试记忆\n`);
  return createdMemories;
}

// 测试基于聚类的记忆检索
async function testClusterMemoryRetrieval() {
  // 不同主题的查询
  const queries = [
    "如何学习JavaScript编程?",
    "机器学习和深度学习的区别是什么?",
    "如何保持身体健康?"
  ];
  
  for (const query of queries) {
    log(`\n查询: "${query}"`);
    
    // 使用新的基于聚类的检索方法
    const relevantMemories = await clusterMemoryRetrieval.retrieveClusterMemories(
      TEST_USER_ID,
      query,
      3
    );
    
    log(`找到 ${relevantMemories.length} 条相关记忆:`);
    
    for (const memory of relevantMemories) {
      log(`- [ID: ${memory.id}] ${memory.content.substring(0, 100)}...`);
    }
  }
}

// 测试知识图谱生成
async function testKnowledgeGraphGeneration() {
  // 获取用户的聚类主题
  const clusterTopics = await clusterMemoryRetrieval.getUserClusterTopics(TEST_USER_ID);
  
  if (!clusterTopics || clusterTopics.length === 0) {
    log("未找到聚类主题，无法生成知识图谱", "error");
    return;
  }
  
  log(`找到 ${clusterTopics.length} 个聚类主题:`);
  for (const topic of clusterTopics) {
    log(`- [${topic.id}] ${topic.topic}: ${topic.count}条记忆 (${topic.percentage}%)`);
  }
  
  // 获取用户所有记忆
  const memories = await storage.getMemoriesByUserId(TEST_USER_ID);
  
  // 获取所有记忆的向量嵌入
  const memoryEmbeddings = [];
  for (const memory of memories) {
    const embedding = await storage.getEmbeddingByMemoryId(memory.id);
    if (embedding) {
      memoryEmbeddings.push({
        id: memory.id,
        vector: embedding.vectorData
      });
    }
  }
  
  // 准备关键词数据
  const keywordsData = [];
  for (const memory of memories) {
    const keywords = await storage.getKeywordsByMemoryId(memory.id);
    if (keywords && keywords.length > 0) {
      keywordsData.push([memory.id.toString(), keywords.map(k => k.keyword)]);
    }
  }
  
  // 执行聚类
  const { kMeansClustering } = await import("./server/services/learning/kmeans_clustering.js");
  const clusterResult = kMeansClustering(
    memoryEmbeddings,
    3, // 3个聚类
    50, // 最大迭代次数
    'cosine' // 使用余弦相似度
  );
  
  log(`K-means聚类完成，生成${clusterResult.centroids.length}个聚类，迭代${clusterResult.iterations}次`);
  
  // 生成知识图谱
  const knowledgeGraph = await generateKnowledgeGraph(clusterResult, memories, keywordsData);
  
  log(`知识图谱生成完成，包含 ${knowledgeGraph.nodes.length} 个节点和 ${knowledgeGraph.links.length} 个连接`);
  
  // 输出节点信息
  log("\n知识图谱节点:");
  for (const node of knowledgeGraph.nodes) {
    log(`- [${node.id}] ${node.label} (类型: ${node.category || '未分类'}, 大小: ${node.size})`);
  }
  
  // 输出连接信息
  log("\n知识图谱连接:");
  for (const link of knowledgeGraph.links) {
    log(`- ${link.source} -> ${link.target} (强度: ${link.value.toFixed(2)})`);
  }
}

// 执行测试
runTest().catch(err => {
  log(`测试执行失败: ${err}`, "error");
});