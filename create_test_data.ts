/**
 * 创建测试数据脚本
 * 为测试用户创建对话记忆和向量嵌入
 */

import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';
import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { generateUserKnowledgeGraph } from './server/services/learning/knowledge_graph';
import fs from 'fs';
import path from 'path';

// 使用ID 15的测试用户
const TEST_USER_ID = 15;

// 测试数据 - 不同主题的对话片段
const MEMORY_DATA = [
  // 聚类算法主题
  {
    content: "用户问: 我想优化我们的聚类算法，特别是处理大量高维向量数据的性能。你有什么建议吗？\n\nAI回答: 对于高维向量数据的聚类优化，我建议：1) 使用降维技术如PCA或t-SNE在聚类前减少维度；2) 实现基于KD树或Ball树的最近邻搜索加速距离计算；3) 采用Mini-Batch K-means来处理大规模数据集；4) 使用轮廓系数自动确定最佳聚类数量；5) 考虑增加缓存机制避免重复计算。",
    summary: "关于聚类算法优化的对话",
    keywords: ["聚类算法", "高维向量", "性能优化", "PCA", "轮廓系数", "缓存机制"],
    topic_index: 0
  },
  {
    content: "用户问: 轮廓系数具体是如何工作的？它为什么适合我们的用例？\n\nAI回答: 轮廓系数评估聚类质量的方法，计算每个点与同簇点的平均距离(a)和与最近其他簇点的平均距离(b)，公式为(b-a)/max(a,b)。取值范围为[-1,1]，越接近1表示聚类效果越好。适合您的用例因为不依赖真实标签，适用于非监督聚类。",
    summary: "关于轮廓系数工作原理的对话",
    keywords: ["轮廓系数", "聚类质量", "评估方法", "非监督聚类"],
    topic_index: 0
  },
  {
    content: "用户问: 我们的向量数据都是3072维的，使用PCA降维会不会丢失太多信息？\n\nAI回答: 针对3072维向量数据使用PCA降维，确实存在丢失信息的风险，但可通过保留85-95%的方差解释率来平衡。也可以考虑只对聚类算法使用降维，同时保留原始向量用于其他分析。",
    summary: "关于高维向量降维的对话",
    keywords: ["PCA降维", "3072维", "方差解释率", "信息丢失"],
    topic_index: 0
  },
  
  // 缓存机制主题
  {
    content: "用户问: 我们需要为聚类结果实现一个有效的缓存系统，避免重复计算。你觉得应该如何设计？\n\nAI回答: 设计聚类结果缓存系统建议：1) 采用多级缓存策略，内存缓存+数据库持久化；2) 使用缓存键设计：user_id + vector_count + hash(向量数据特征)；3) 实现基于时间和数据变化的双重失效机制；4) 存储完整聚类结果和元数据；5) 添加版本号字段支持缓存升级。",
    summary: "关于聚类结果缓存系统设计的对话",
    keywords: ["缓存系统", "多级缓存", "失效机制", "聚类结果"],
    topic_index: 1
  },
  {
    content: "用户问: 缓存过期策略应该怎么定？我们的用户数据更新频率不一。\n\nAI回答: 为适应不同用户的数据更新频率，建议实现动态缓存过期策略：1) 基础过期时间：设置默认过期时间；2) 活跃度调整：活跃用户缓存期短，不活跃用户缓存期长；3) 数据变化触发：监测新记忆添加数量，当超过阈值自动使缓存失效；4) 向量特征变化检测。",
    summary: "关于缓存过期策略的对话",
    keywords: ["缓存过期", "动态策略", "数据更新频率", "活跃度调整"],
    topic_index: 1
  },
  {
    content: "用户问: 如果向量数据变化不大，还需要重新计算聚类结果吗？有没有办法判断变化是否显著？\n\nAI回答: 当向量数据变化不大时，可以避免重新计算聚类，通过以下方法判断变化是否显著：1) 向量集合哈希比较；2) 统计特征比较；3) 向量数量变化率；4) 质心稳定性检查；5) 特征空间密度分析。设置变化显著性阈值，只有超过阈值才重新计算。",
    summary: "关于判断向量数据变化显著性的对话",
    keywords: ["向量数据", "变化显著性", "重新计算", "质心稳定性"],
    topic_index: 1
  },
  
  // Python服务集成主题
  {
    content: "用户问: 我们需要将Python的聚类服务与TypeScript代码集成，你有什么建议？\n\nAI回答: 集成Python聚类服务与TypeScript代码的最佳方案：1) 创建REST API：使用Flask/FastAPI构建Python微服务；2) 进程间通信：使用node-ipc或child_process.spawn；3) JSON序列化：用于数据交换；4) TypeScript接口定义：为Python服务创建清晰的TS接口；5) 错误处理与重试；6) 服务健康检查。",
    summary: "关于Python与TypeScript集成的对话",
    keywords: ["Python", "TypeScript", "聚类服务", "REST API", "进程间通信"],
    topic_index: 2
  },
  {
    content: "用户问: 我们的Python服务需要处理大量向量数据，有什么优化传输效率的方法？\n\nAI回答: 优化Python服务与TypeScript间大量向量数据传输的方法：1) 数据压缩：使用gzip/zlib压缩JSON数据；2) 二进制格式：采用MessagePack或Protocol Buffers；3) 增量传输：只传送变化的向量；4) 数据分块：大型数据集分批传输；5) 量化技术：使用定点数或降低精度减小向量大小。",
    summary: "关于优化向量数据传输效率的对话",
    keywords: ["数据传输", "向量数据", "压缩", "二进制格式", "增量传输"],
    topic_index: 2
  },
  {
    content: "用户问: 如何确保Python服务在处理大规模聚类时不会崩溃或占用过多内存？\n\nAI回答: 确保Python聚类服务稳定处理大规模数据的策略：1) 增量聚类算法：使用Mini-Batch K-means；2) 内存监控与限制：实现内存使用监控；3) 数据分批处理；4) 结果缓存与复用；5) 高效数据结构：使用NumPy数组和稀疏矩阵；6) 进程隔离：使用multiprocessing；7) 自动重启机制。",
    summary: "关于Python服务稳定性和内存管理的对话",
    keywords: ["Python服务", "大规模聚类", "内存管理", "增量算法", "进程隔离"],
    topic_index: 2
  },
  
  // 学习轨迹分析主题
  {
    content: "用户问: 我们需要基于聚类结果生成用户的学习轨迹，有什么好的方法？\n\nAI回答: 基于聚类结果生成学习轨迹的方法：1) 时序分析：按时间顺序分析用户关注主题的变化；2) 主题关联图：构建知识点关联网络；3) 兴趣强度跟踪；4) 学习阶段识别：使用KWLQ模型；5) 知识图谱映射；6) 推荐下一步：基于已学内容推荐相关主题；7) 可视化时间线：创建交互式时间线展示学习进展。",
    summary: "关于生成学习轨迹的对话",
    keywords: ["学习轨迹", "聚类结果", "时序分析", "KWLQ模型", "知识图谱"],
    topic_index: 3
  },
  {
    content: "用户问: KWLQ模型是什么？它如何帮助我们分析学习阶段？\n\nAI回答: KWLQ模型是学习阶段分析框架，将学习分为四阶段：K(Know)已知内容、W(Want)想学内容、L(Learned)新学到内容、Q(Questions)疑问内容。可识别知识点学习阶段、追踪知识转变、发现学习盲点、个性化推荐、生成学习报告。",
    summary: "关于KWLQ学习阶段模型的对话",
    keywords: ["KWLQ模型", "学习阶段", "知识追踪", "学习分析"],
    topic_index: 3
  },
  {
    content: "用户问: 如何确定知识点之间的关联度？我们想在学习轨迹中显示知识点之间的联系。\n\nAI回答: 确定知识点关联度的方法有：1) 向量空间相似度：计算聚类质心向量的余弦相似度；2) 共现分析：分析知识点在对话中的共同出现频率；3) 时序转换概率；4) 关键词重叠度：计算Jaccard系数；5) 语义关联分析：使用大语言模型评估主题间的语义联系。可视化中使用连线粗细或颜色表示关联强度。",
    summary: "关于知识点关联度计算的对话",
    keywords: ["知识点关联", "向量相似度", "共现分析", "关键词重叠", "语义关联"],
    topic_index: 3
  },
  
  // 知识图谱主题
  {
    content: "用户问: 我想基于用户的学习内容自动构建知识图谱，帮助发现知识间的联系。有什么建议？\n\nAI回答: 自动构建知识图谱的方法：1) 实体识别与提取：使用NER技术；2) 关系抽取：基于依存分析；3) 聚类结果映射：将记忆聚类映射为知识节点；4) 层次化表示：建立概念间的层次关系；5) 知识融合；6) 可视化策略：使用力导向图或环形布局展示知识结构；7) 动态更新：随用户学习进展实时更新图谱。",
    summary: "关于自动构建知识图谱的对话",
    keywords: ["知识图谱", "实体识别", "关系抽取", "聚类映射", "可视化"],
    topic_index: 4
  },
  {
    content: "用户问: 有什么好的知识图谱可视化方案？我们需要在前端展示复杂的知识关联。\n\nAI回答: 知识图谱可视化最佳方案：1) 力导向图：D3.js的force-directed layout；2) 分层树状图：展示层次关系；3) 环形布局：将相关知识点放置在同心圆上；4) 桑基图：展示知识流动；5) 多焦点视图；6) 3D知识球体：使用Three.js创建3D交互式知识空间；7) 时间线整合。使用React-Force-Graph组件封装D3.js，支持丰富交互功能。",
    summary: "关于知识图谱可视化方案的对话",
    keywords: ["知识图谱", "可视化", "力导向图", "D3.js", "React-Force-Graph"],
    topic_index: 4
  },
  {
    content: "用户问: 我们的知识图谱节点可能会很多，如何避免视觉混乱，保持清晰的展示？\n\nAI回答: 避免知识图谱节点过多导致的视觉混乱：1) 分层展示：初始只显示高层主题节点；2) 重要性过滤：根据节点中心度等指标显示最重要节点；3) 语义聚合：相似知识点合并为超级节点；4) 交互式搜索；5) 关系过滤器；6) 局部视图效果；7) 边捆绑技术；8) 多视图联动；9) WebGL加速渲染，优化大规模节点的性能。",
    summary: "关于优化知识图谱视觉展示的对话",
    keywords: ["知识图谱", "视觉混乱", "分层展示", "节点过滤", "边捆绑"],
    topic_index: 4
  }
];

// 生成时间戳ID的函数
function generateTimestampId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  // 添加一个随机数以避免同一毫秒创建的ID冲突
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${random}`;
}

// 生成向量嵌入的函数
function generateVectorForTopic(topicIndex: number): number[] {
  // 创建一个3072维的随机向量
  const vector = Array(3072).fill(0).map(() => (Math.random() - 0.5) * 0.01);
  
  // 为同一主题的内容创建相似的向量特征，以便聚类时能够正确分组
  const segmentSize = 3072 / 5; // 将3072维均分为5个段，每个主题强化不同段
  const segmentStart = topicIndex * segmentSize; 
  
  // 在特定段中设置较高的值，使得同一主题的向量相似
  for (let i = 0; i < segmentSize; i++) {
    vector[Math.floor(segmentStart + i)] = Math.random() * 0.5 + 0.5; // 0.5-1.0之间的值
  }
  
  // 添加一些随机变化，使得即使是同一主题也有一定差异
  for (let i = 0; i < 3072; i++) {
    if (Math.random() < 0.05) { // 5%的维度有显著差异
      vector[i] = Math.random() * 0.3 + 0.2;
    }
  }
  
  return vector;
}

// 主函数 - 生成所有测试数据
async function generateTestData(): Promise<void> {
  try {
    console.log(`开始为用户ID=${TEST_USER_ID}生成测试数据...`);

    // 清理现有测试数据
    console.log(`清理用户现有数据...`);
    await storage.clearClusterResultCache(TEST_USER_ID);
    console.log(`清理集群缓存完成`);
    await storage.clearKnowledgeGraphCache(TEST_USER_ID);
    console.log(`清理知识图谱缓存完成`);

    const existingMemories = await storage.getMemoriesByUserId(TEST_USER_ID);
    for (const memory of existingMemories) {
      await storage.deleteMemory(memory.id);
    }
    console.log(`删除${existingMemories.length}条现有记忆完成`);

    // 创建新的记忆数据
    const memoryIds: string[] = [];
    for (let i = 0; i < MEMORY_DATA.length; i++) {
      const memoryItem = MEMORY_DATA[i];
      
      // 创建记忆
      console.log(`创建第${i+1}/${MEMORY_DATA.length}条记忆...`);
      const memory = await storage.createMemory(
        TEST_USER_ID,
        memoryItem.content,
        "chat",
        memoryItem.summary
      );
      
      memoryIds.push(memory.id);
      
      // 添加关键词
      for (const keyword of memoryItem.keywords) {
        await storage.addKeywordToMemory(memory.id, keyword);
      }
      
      // 创建向量嵌入
      const vector = generateVectorForTopic(memoryItem.topic_index);
      await storage.saveMemoryEmbedding(memory.id, vector);
      console.log(`为记忆${memory.id}创建了3072维向量嵌入`);
      
      // 添加延迟以避免过快创建记忆
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`完成数据生成！总共创建了${memoryIds.length}条记忆`);

    // 触发聚类计算和知识图谱生成
    console.log(`触发聚类计算...`);
    const clusterResult = await memoryService.getUserClusters(TEST_USER_ID, true);
    console.log(`聚类计算完成，发现${clusterResult.clusterCount}个聚类`);

    // 生成知识图谱
    console.log(`生成知识图谱...`);
    const knowledgeGraph = await generateUserKnowledgeGraph(TEST_USER_ID, true);
    console.log(`知识图谱生成完成，包含${knowledgeGraph.nodes.length}个节点和${knowledgeGraph.links.length}个连接`);

    // 记录结果
    const result = {
      userId: TEST_USER_ID,
      timestamp: new Date().toISOString(),
      memoriesCreated: memoryIds.length,
      clusterCount: clusterResult.clusterCount,
      knowledgeGraphNodes: knowledgeGraph.nodes.length,
      knowledgeGraphLinks: knowledgeGraph.links.length
    };

    // 保存结果
    const resultsDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const resultFile = path.join(resultsDir, `test_data_result_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
    console.log(`结果已保存到: ${resultFile}`);

  } catch (error) {
    console.error(`生成测试数据时出错: ${error}`);
  }
}

// 执行数据生成
generateTestData().catch(error => {
  console.error(`未处理的错误: ${error}`);
});