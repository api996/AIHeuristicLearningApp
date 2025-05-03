/**
 * 记忆流程验证脚本
 * 模拟用户ID 15的学习相关对话，并验证完整流程
 */

import { db } from "./server/db.js";
import { log } from "./server/vite.js";

/**
 * 颜色化日志输出
 * @param {string} message 消息文本
 * @param {string} type 消息类型
 */
function colorLog(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type] || colors.info, message);
}

/**
 * 生成时间戳ID
 * @returns {string} 时间戳ID
 */
function generateTimestampId() {
  const timestamp = Date.now().toString();
  return timestamp;
}

/**
 * 为用户创建学习相关的聊天记忆
 * @param {number} userId 用户ID
 * @param {number} count 记忆数量
 */
async function createLearningMemories(userId, count = 20) {
  let learningContent = [
    // 对比几种机器学习框架的对话
    {
      content: "机器学习框架之间有什么主要区别？我听说TensorFlow、PyTorch和scikit-learn都很流行，但不确定该用哪个。",
      type: "user_message"
    },
    {
      content: "这三个框架各有特点：\n\nTensorFlow：由Google开发，生产环境友好，适合大规模部署，有TensorFlow Lite和TensorFlow.js分支，静态计算图设计，近年来引入了即时执行模式。\n\nPyTorch：由Facebook开发，动态计算图使调试更容易，研究人员偏爱，API更直观，支持分布式训练，近年在企业应用中正迅速增长。\n\nScikit-learn：简单易用，专注经典机器学习算法（非深度学习），适合数据分析和预测建模入门，与pandas和NumPy无缝集成。\n\n选择标准：如果是研究深度学习，PyTorch可能更适合；如果需要生产级部署，TensorFlow有优势；如果是传统机器学习任务，scikit-learn足够。",
      type: "assistant_message"
    },
    
    // 向量数据库对话
    {
      content: "向量数据库和传统数据库有什么不同？什么情况下应该使用向量数据库？",
      type: "user_message"
    },
    {
      content: "向量数据库与传统数据库的主要区别：\n\n1. 数据表示：传统数据库存储结构化数据（行列），向量数据库存储高维向量（数值数组）\n2. 查询方式：传统数据库使用精确匹配（SQL），向量数据库使用相似性搜索（余弦相似度等）\n3. 用途：传统数据库适合事务处理，向量数据库适合语义搜索和AI应用\n4. 性能优化：向量数据库针对高维空间搜索优化，使用特殊索引（HNSW、IVF等）\n\n适合使用向量数据库的场景：\n- 语义搜索和推荐系统\n- 图像、音频等多媒体相似性搜索\n- 大语言模型的知识库构建\n- 异常检测和聚类分析\n\n常见向量数据库包括Pinecone、Milvus、Weaviate、Qdrant和Chroma。",
      type: "assistant_message"
    },
    
    // 神经网络架构对话
    {
      content: "卷积神经网络和循环神经网络在处理数据上有什么根本区别？它们各自适合哪些应用场景？",
      type: "user_message"
    },
    {
      content: "卷积神经网络(CNN)与循环神经网络(RNN)的根本区别：\n\n1. 数据处理方式：\n   - CNN：利用卷积核在空间维度提取局部特征，适合处理具有空间结构的数据\n   - RNN：顺序处理数据，保持内部隐藏状态以记忆之前的信息，适合处理时序数据\n\n2. 连接方式：\n   - CNN：主要是前馈连接，每层独立处理\n   - RNN：具有循环连接，允许信息在时间维度上传递\n\n3. 参数共享：\n   - CNN：在空间维度共享参数（同一卷积核应用于不同位置）\n   - RNN：在时间维度共享参数（相同权重用于不同时间步）\n\n适用场景：\n- CNN适合：图像识别、计算机视觉、医学影像分析、一些NLP任务\n- RNN适合：序列预测、自然语言处理、语音识别、时间序列分析\n\n现代应用中常见的变体包括ResNet(CNN)和LSTM/GRU(RNN)，而Transformer架构则结合了二者的优点。",
      type: "assistant_message"
    },
    
    // 强化学习对话
    {
      content: "强化学习的基本原理是什么？它与监督学习和非监督学习相比有哪些不同？",
      type: "user_message"
    },
    {
      content: "强化学习基本原理：\n\n- 智能体(Agent)在环境中采取行动(Action)\n- 环境返回新状态(State)和奖励(Reward)\n- 智能体学习最大化长期累积奖励的策略(Policy)\n- 核心组件：状态、行动、奖励函数、策略、价值函数\n\n与其他学习方式的区别：\n\n监督学习：\n- 有标记数据直接指导学习\n- 一次性反馈\n- 静态问题，无交互\n\n非监督学习：\n- 无标记数据，寻找隐藏结构\n- 无明确反馈\n- 专注数据本身模式\n\n强化学习：\n- 有延迟反馈（奖励）\n- 交互式学习过程\n- 需平衡探索与利用\n- 智能体行动影响后续数据\n\n经典算法包括Q-learning、策略梯度、DQN和PPO，适用于游戏AI、机器人控制、推荐系统等场景。",
      type: "assistant_message"
    },
    
    // 大语言模型架构对话
    {
      content: "Transformer模型架构与RNN/LSTM相比有哪些优势？为什么它能在大语言模型中表现得如此出色？",
      type: "user_message"
    },
    {
      content: "Transformer相比RNN/LSTM的关键优势：\n\n1. 并行计算能力：\n   - Transformer可并行处理所有输入，大幅提高训练效率\n   - RNN/LSTM必须按顺序处理，速度受限\n\n2. 长距离依赖捕获：\n   - 通过自注意力机制直接建立任意位置之间的连接\n   - 克服了RNN/LSTM在长序列上的梯度消失问题\n\n3. 模型容量扩展性：\n   - 能够轻松扩展到数十亿参数量级\n   - 多头注意力机制允许同时关注不同特征空间\n\n4. 位置编码灵活性：\n   - 不依赖序列顺序处理，可灵活处理不同长度输入\n   - 通过显式位置编码保留序列信息\n\n在大语言模型中表现出色的原因：\n- 注意力机制提供了更强的上下文理解能力\n- 自回归预训练方法与架构完美契合\n- 能有效利用大规模数据和计算资源进行扩展\n- 多层网络设计允许层次化特征提取\n\nTransformer模型家族（如GPT、BERT、T5）已成为NLP领域的标准架构，并扩展到计算机视觉等其他领域。",
      type: "assistant_message"
    },
    
    // 概率图模型对话
    {
      content: "贝叶斯网络是什么？它与决策树、随机森林相比有哪些优缺点？",
      type: "user_message"
    },
    {
      content: "贝叶斯网络概述：\n\n- 是一种概率图模型，用有向无环图(DAG)表示变量间的条件依赖关系\n- 结合图论和概率论，通过节点表示变量，边表示条件依赖\n- 基于贝叶斯定理计算联合概率分布，节点包含条件概率表\n\n与决策树比较：\n优势：\n- 能明确建模变量间因果关系和不确定性\n- 可融合先验知识和不完整数据\n- 提供不确定性估计和解释性\n劣势：\n- 结构学习计算复杂度高\n- 需要更多领域知识定义结构\n- 连续变量处理较复杂\n\n与随机森林比较：\n优势：\n- 提供可解释的概率推理框架\n- 能处理缺失数据和小样本集\n- 可进行双向推理(预测和诊断)\n劣势：\n- 扩展到高维特征空间较困难\n- 预测精度可能低于随机森林\n- 训练过程不如随机森林自动化\n\n应用场景包括医疗诊断、风险评估、故障诊断和知识表示系统。",
      type: "assistant_message"
    },
    
    // 机器学习评估方法对话
    {
      content: "如何评估机器学习模型的性能？不同任务类型应该使用哪些评估指标？",
      type: "user_message"
    },
    {
      content: "机器学习模型评估指标与方法：\n\n分类任务评估指标：\n- 准确率(Accuracy)：整体正确分类的比例，适合类别平衡问题\n- 精确率(Precision)：预测为正例中真正例的比例，关注误报\n- 召回率(Recall/灵敏度)：真正例中被正确预测的比例，关注漏报\n- F1分数：精确率和召回率的调和平均，平衡两者\n- AUC-ROC：真正例率vs假正例率曲线下面积，评估排序质量\n- 混淆矩阵：详细展示各类别预测情况\n\n回归任务评估指标：\n- 均方误差(MSE)：预测值与真实值差异的平方平均\n- 平均绝对误差(MAE)：预测误差的绝对值平均，对异常值不敏感\n- R²：模型解释的方差比例，评估拟合优度\n- RMSE：MSE的平方根，与原始数据单位一致\n\n聚类任务评估指标：\n- 轮廓系数：评估聚类紧密度与分离度\n- 调整兰德指数：聚类与真实标签的一致性(有监督评估)\n\n评估方法：\n- 交叉验证：如k折交叉验证，减少过拟合风险\n- 留一法：特殊的交叉验证，用于小数据集\n- 时间序列分割：按时间顺序分割训练与测试数据\n\n选择评估指标时应考虑业务需求、数据分布特点和模型使用场景。",
      type: "assistant_message"
    },
    
    // 自然语言处理对话
    {
      content: "自然语言处理中的词嵌入技术有哪些？它们各自的原理和应用场景是什么？",
      type: "user_message"
    },
    {
      content: "NLP词嵌入技术概览：\n\n1. Word2Vec (2013)\n   原理：基于神经网络，使用CBOW或Skip-gram模型预测上下文/目标词\n   特点：捕捉语义相似性，支持词的代数运算\n   维度：通常300维左右\n   限制：静态嵌入，一词多义问题\n   应用：文本分类、信息检索\n\n2. GloVe (2014)\n   原理：结合全局矩阵分解和局部上下文窗口，利用共现统计\n   特点：结合全局统计与局部上下文\n   优势：在某些任务上比Word2Vec表现更好\n   应用：语义分析、命名实体识别\n\n3. FastText (2016)\n   原理：扩展Word2Vec，处理子词(n-gram)级别信息\n   特点：能处理词缀和罕见词\n   优势：适合形态丰富的语言和专业领域\n   应用：多语言处理、拼写检查\n\n4. ELMo (2018)\n   原理：双向LSTM生成动态上下文相关嵌入\n   特点：动态表示，解决一词多义\n   应用：语义分析、问答系统\n\n5. BERT嵌入 (2018)\n   原理：基于Transformer的预训练模型\n   特点：深度双向上下文表示\n   优势：捕捉复杂语言结构和语境\n   应用：各种高级NLP任务\n\n6. 领域特定嵌入\n   如：BioWordVec(生物医学)、LegalBERT(法律)\n   优势：针对专业术语和语境优化\n\n选择考虑因素：任务复杂度、计算资源、可解释性需求和领域特性。现代NLP系统通常使用上下文嵌入(BERT等)获得最佳性能。",
      type: "assistant_message"
    },
    
    // 机器学习项目流程对话
    {
      content: "完整的机器学习项目流程应该包括哪些步骤？每个步骤的关键点和常见陷阱是什么？",
      type: "user_message"
    },
    {
      content: "机器学习项目完整流程及关键点：\n\n1. 问题定义\n   关键点：明确业务目标、定义成功指标、确定项目约束\n   陷阱：目标过于模糊、忽视可行性评估\n\n2. 数据收集\n   关键点：识别数据源、确保数据质量和代表性、考虑数据隐私\n   陷阱：数据量不足、忽略数据偏差、违反合规要求\n\n3. 数据准备与探索\n   关键点：清洗数据、处理缺失值、识别异常值、特征工程\n   陷阱：数据泄漏、过度处理、忽略特征分布\n\n4. 特征选择与工程\n   关键点：创建有意义特征、降维、标准化、编码分类变量\n   陷阱：过度拟合特征选择、忽略领域知识\n\n5. 模型选择与训练\n   关键点：选择合适算法、划分训练/验证/测试集、超参数优化\n   陷阱：忽视简单基线模型、过早复杂化、训练/测试集划分不当\n\n6. 模型评估\n   关键点：选择合适评估指标、交叉验证、理解错误模式\n   陷阱：优化错误指标、忽视置信区间、过于依赖单一指标\n\n7. 模型部署\n   关键点：模型序列化、API设计、监控策略、版本控制\n   陷阱：忽视延迟/资源需求、缺乏异常处理\n\n8. 监控与维护\n   关键点：设置性能基准、数据漂移检测、定期再训练\n   陷阱：忽视模型退化、缺乏自动化流程\n\n9. 反馈与迭代\n   关键点：收集用户反馈、A/B测试、持续改进\n   陷阱：过度优化、忽视业务指标变化\n\n最佳实践：\n- 采用MLOps工具和方法确保可重复性\n- 文档记录决策和实验\n- 构建可解释和透明的模型\n- 确保跨职能团队合作\n\n成功项目强调迭代改进和持续评估，而非一次性实现完美模型。",
      type: "assistant_message"
    }
  ];

  colorLog(`开始为用户 ${userId} 创建 ${count} 条学习相关记忆...`, 'info');
  
  // 确保内容数量足够
  while (learningContent.length < count) {
    learningContent = learningContent.concat(learningContent);
  }
  
  // 截取所需数量
  const selectedContent = learningContent.slice(0, count);
  
  // 创建记忆记录
  const memories = [];
  let createdCount = 0;
  
  for (const item of selectedContent) {
    try {
      // 生成时间戳ID
      const memoryId = generateTimestampId();
      
      // 计算时间戳，随机分布在过去30天内
      const randomDaysAgo = Math.floor(Math.random() * 30);
      const timestamp = new Date();
      timestamp.setDate(timestamp.getDate() - randomDaysAgo);
      
      // 插入记忆记录
      const [memory] = await db
        .insert(db.schema.memories)
        .values({
          id: memoryId,
          userId: userId,
          content: item.content,
          type: item.type,
          timestamp: timestamp.toISOString(),
          createdAt: timestamp.toISOString()
        })
        .returning();
      
      memories.push(memory);
      createdCount++;
      colorLog(`创建记忆成功: ID=${memoryId}, 类型=${item.type}`, 'success');
    } catch (error) {
      colorLog(`创建记忆失败: ${error}`, 'error');
    }
  }
  
  colorLog(`成功创建 ${createdCount} 条记忆`, 'success');
  return memories;
}

/**
 * 手动触发向量嵌入生成
 */
async function triggerEmbeddingGeneration() {
  try {
    colorLog(`手动触发向量嵌入生成流程...`, 'info');
    
    // 获取服务实例
    const vectorEmbeddingsModule = await import('./server/services/learning/vector_embeddings.js');
    const vectorEmbeddingsService = vectorEmbeddingsModule.vectorEmbeddingsService;
    
    // 获取用户所有记忆
    const memories = await db.select()
      .from(db.schema.memories)
      .where(db.eq(db.schema.memories.userId, 15));
    
    if (!memories || memories.length === 0) {
      colorLog(`用户没有任何记忆记录`, 'warn');
      return;
    }
    
    colorLog(`找到 ${memories.length} 条记忆记录，开始生成嵌入...`, 'info');
    
    // 为所有记忆生成嵌入
    const result = await vectorEmbeddingsService.batchGenerateEmbeddings(memories, true);
    
    colorLog(`嵌入生成完成，成功数量: ${result}`, 'success');
  } catch (error) {
    colorLog(`触发嵌入生成失败: ${error.stack}`, 'error');
  }
}

/**
 * 手动触发聚类和主题生成
 */
async function triggerClusteringAndTopicGeneration() {
  try {
    colorLog(`手动触发聚类和主题生成流程...`, 'info');
    
    // 获取服务实例
    const clusterModule = await import('./server/services/learning/cluster_memory_retrieval.js');
    const clusterMemoryRetrieval = clusterModule.clusterMemoryRetrieval;
    
    // 强制刷新聚类结果
    const userId = 15;
    const clusterResult = await clusterMemoryRetrieval.getUserClusters(userId, true);
    
    if (!clusterResult) {
      colorLog(`获取聚类数据失败`, 'error');
      return;
    }
    
    colorLog(`聚类成功，获取到 ${clusterResult.centroids.length} 个聚类`, 'success');
    
    // 获取主题
    const topics = await clusterMemoryRetrieval.getUserClusterTopics(userId, true);
    
    if (!topics || topics.length === 0) {
      colorLog(`主题生成失败或结果为空`, 'warn');
      return;
    }
    
    colorLog(`主题生成成功，获取到 ${topics.length} 个主题:`, 'success');
    topics.forEach((topic, index) => {
      colorLog(`主题 ${index+1}: ${topic.name} (包含 ${topic.memoryIds.length} 条记忆)`, 'info');
    });
  } catch (error) {
    colorLog(`触发聚类和主题生成失败: ${error.stack}`, 'error');
  }
}

/**
 * 手动触发学习轨迹生成
 */
async function triggerLearningTrajectory() {
  try {
    colorLog(`手动触发学习轨迹生成...`, 'info');
    
    // 获取服务实例
    const trajectoryModule = await import('./server/services/learning/learning_trajectory.js');
    const learningTrajectoryService = trajectoryModule.learningTrajectoryService;
    
    // 生成轨迹
    const userId = 15;
    const trajectory = await learningTrajectoryService.generateLearningTrajectory(userId);
    
    if (!trajectory) {
      colorLog(`学习轨迹生成失败或结果为空`, 'warn');
      return;
    }
    
    const topicsCount = trajectory.topics ? trajectory.topics.length : 0;
    const suggestionsCount = trajectory.suggestions ? trajectory.suggestions.length : 0;
    
    colorLog(`学习轨迹生成成功: ${topicsCount} 个主题, ${suggestionsCount} 条建议`, 'success');
    
    if (trajectory.topics && trajectory.topics.length > 0) {
      colorLog(`主题:`, 'info');
      trajectory.topics.forEach(topic => {
        colorLog(`- ${topic.name}`, 'info');
      });
    }
    
    if (trajectory.suggestions && trajectory.suggestions.length > 0) {
      colorLog(`学习建议:`, 'info');
      trajectory.suggestions.forEach(suggestion => {
        colorLog(`- ${suggestion}`, 'info');
      });
    }
  } catch (error) {
    colorLog(`触发学习轨迹生成失败: ${error.stack}`, 'error');
  }
}

/**
 * 运行完整的记忆流程模拟
 */
async function runFullSimulation() {
  try {
    // 步骤1: 创建记忆
    colorLog(`=== 步骤1: 创建记忆记录 ===`, 'info');
    const userId = 15;
    const memories = await createLearningMemories(userId, 20);
    
    // 给系统一些时间进行处理
    colorLog(`等待5秒，确保记忆记录被保存...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 步骤2: 触发向量嵌入生成
    colorLog(`=== 步骤2: 生成向量嵌入 ===`, 'info');
    await triggerEmbeddingGeneration();
    
    // 给系统一些时间处理嵌入
    colorLog(`等待10秒，确保嵌入生成完成...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 步骤3: 触发聚类和主题生成
    colorLog(`=== 步骤3: 执行聚类和生成主题 ===`, 'info');
    await triggerClusteringAndTopicGeneration();
    
    // 给系统一些时间处理
    colorLog(`等待5秒，确保聚类和主题生成完成...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 步骤4: 生成学习轨迹
    colorLog(`=== 步骤4: 生成学习轨迹 ===`, 'info');
    await triggerLearningTrajectory();
    
    colorLog(`模拟完成!`, 'success');
  } catch (error) {
    colorLog(`运行模拟失败: ${error.stack}`, 'error');
  } finally {
    // 关闭数据库连接
    // 注意: 在这个环境中db是由服务器管理的，不需要显式关闭
    // await db.end();
  }
}

// 执行完整模拟
runFullSimulation();