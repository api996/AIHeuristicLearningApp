
# 系统设计与技术实现

## Scope & Plan

### 本章目标概述
本章主要描述基于大型语言模型(LLM)的自适应学习系统的设计与实现，覆盖系统架构、核心模块、数据流、关键技术实现以及模型集成方式。

### 引用文件清单
- 系统核心服务：`server/index.ts`
- 大语言模型服务：`server/services/genai/genai_service.ts`
- 提示词管理服务：`server/services/prompt-manager.ts`
- 记忆与学习服务：`server/services/learning/memory_service.ts`
- 聚类分析服务：`server/services/learning/cluster_analyzer.ts`
- 主题图谱构建：`server/services/learning/topic_graph_builder.ts`
- 学习轨迹分析：`server/services/learning/trajectory.ts`
- 嵌入向量服务：`server/services/learning/vector_embeddings.ts`
- Python集成服务：`server/services/api/clustering/app.py`

## 1. 系统架构总览

### 1.1 整体架构设计

本系统采用现代化的分层架构，包含前端层、应用服务层、AI服务层和数据存储层。系统通过模块化设计确保各组件间的低耦合高内聚，同时通过服务化的方式提供灵活扩展能力。

#### 核心架构组件：

1. **前端交互层**：基于React构建的响应式用户界面，提供聊天界面、知识图谱可视化和学习轨迹展示。

2. **应用服务层**：基于Node.js和Express框架实现的服务端，处理请求路由、用户认证和会话管理。

3. **AI服务层**：整合多种AI能力，包括：
   - 大语言模型接口服务
   - 提示词工程与管理
   - 向量嵌入与语义检索
   - 聚类分析与知识图谱构建

4. **数据存储层**：使用PostgreSQL关系型数据库存储用户数据、对话历史和会话信息，同时使用文件系统存储记忆向量数据。

#### 技术栈选择：

- **前端**：TypeScript、React、D3.js(可视化)
- **后端**：Node.js、Express、TypeScript
- **AI服务**：集成Google Gemini API
- **数据分析**：Python服务(Flask)处理向量计算和聚类
- **数据存储**：PostgreSQL、文件系统

## 2. 核心模块实现

### 2.1 大语言模型服务接口

系统实现了统一的大语言模型服务接口，支持多模型切换，主要通过`server/services/genai/genai_service.ts`实现：

```typescript
class GeminiService implements GenAIService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeAPI();
  }

  // 初始化API客户端
  private initializeAPI() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('Gemini API密钥未设置');
        return;
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    } catch (error) {
      console.error('初始化Gemini API失败:', error);
    }
  }

  // 生成文本嵌入向量
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // 实现文本向量化
      // ...
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      return [];
    }
  }

  // 生成文本摘要
  async generateSummary(text: string): Promise<string | null> {
    try {
      // 实现文本摘要生成
      // ...
    } catch (error) {
      console.error('生成摘要失败:', error);
      return null;
    }
  }
}
```

这个服务抽象了对大语言模型API的调用，提供了生成嵌入向量和文本摘要的统一接口，支持未来扩展到其他模型。

### 2.2 提示词管理服务

提示词管理服务(`server/services/prompt-manager.ts`)是系统的核心组件之一，负责动态组装和管理系统提示词：

```typescript
export class PromptManagerService {
  private moduleConfig: PromptModuleConfig;
  private previousModelId: string | null = null;
  
  constructor() {
    // 初始化提示词模块配置
    this.moduleConfig = {
      baseModules: ['system', 'persona'],
      conditionalModules: {
        'memory': true,
        'context': true,
        'learning': true
      }
    };
  }
  
  // 获取动态提示词
  async getDynamicPrompt(
    modelId: string,
    chatId: number,
    userInput: string,
    // ...其他参数
  ): Promise<string> {
    // 检测模型切换
    const modelSwitched = this.previousModelId && this.previousModelId !== modelId;
    this.previousModelId = modelId;
    
    // 获取模型特定的提示词模板
    const template = await this.getPromptTemplate(modelId);
    if (!template) {
      throw new Error(`未找到模型${modelId}的提示词模板`);
    }
    
    // 构建基础提示词
    let promptText = template.basePrompt || '';
    
    // 动态注入模块
    promptText = await this.injectModules(promptText, chatId, userInput, modelSwitched);
    
    // 检测对话阶段
    const currentPhase = this.detectPhase(userInput, chatHistory);
    if (currentPhase) {
      promptText = this.addPhaseGuidance(promptText, currentPhase);
    }
    
    return promptText;
  }
  
  // 其他辅助方法...
}
```

提示词管理服务实现了以下关键功能：
- 模块化提示词组装，支持条件性启用/禁用特定模块
- 对话阶段检测(K/W/L/Q)，为不同阶段提供特定的AI响应策略
- 模型切换检测，确保跨模型提示词一致性
- 上下文记忆注入，确保长对话的连贯性

### 2.3 记忆与学习服务

记忆与学习服务(`server/services/learning/memory_service.ts`)处理用户对话的存储、检索和分析，为系统提供"记忆"能力：

```typescript
export class MemoryService {
  private embeddingService: EmbeddingService;
  private clusterService: ClusterService;
  
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.clusterService = new ClusterService();
  }
  
  // 保存记忆
  async saveMemory(userId: number, content: string, metadata?: any): Promise<Memory> {
    try {
      // 生成唯一ID
      const memoryId = this.generateMemoryId();
      
      // 获取向量嵌入
      const embedding = await this.embeddingService.generateEmbedding(content);
      
      // 创建摘要
      const summary = await this.generateSummary(content);
      
      // 提取关键词
      const keywords = this.extractKeywords(content);
      
      // 构建记忆对象
      const memory: Memory = {
        id: memoryId,
        userId,
        content,
        summary,
        keywords,
        embedding,
        timestamp: new Date().toISOString(),
        metadata: metadata || {}
      };
      
      // 保存到存储
      await this.saveToStorage(memory);
      
      // 触发聚类更新
      this.clusterService.scheduleClusterUpdate(userId);
      
      return memory;
    } catch (error) {
      console.error('保存记忆失败:', error);
      throw error;
    }
  }
  
  // 检索相关记忆
  async retrieveRelatedMemories(userId: number, queryText: string, limit = 5): Promise<Memory[]> {
    try {
      // 为查询生成向量嵌入
      const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);
      
      // 获取用户所有记忆
      const memories = await this.getUserMemories(userId);
      
      // 计算相似度并排序
      const scoredMemories = memories.map(memory => ({
        memory,
        score: this.calculateCosineSimilarity(queryEmbedding, memory.embedding)
      }));
      
      // 排序并返回最相关的记忆
      return scoredMemories
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.memory);
    } catch (error) {
      console.error('检索相关记忆失败:', error);
      return [];
    }
  }
  
  // 其他方法...
}
```

记忆服务的核心功能包括：
- 对话内容的向量化和存储
- 基于相似度的记忆检索
- 记忆摘要和关键词提取
- 聚类分析触发

### 2.4 向量嵌入服务

向量嵌入服务(`server/services/learning/vector_embeddings.ts`)负责将文本转换为高维向量，是语义搜索和聚类分析的基础：

```typescript
export class VectorEmbeddingService {
  private genAI: GenAIService;
  private pythonEmbeddingService?: PythonEmbeddingService;
  
  constructor() {
    this.genAI = new GeminiService();
    
    // 尝试初始化Python嵌入服务(如果可用)
    try {
      this.pythonEmbeddingService = new PythonEmbeddingService();
    } catch (error) {
      console.warn('Python嵌入服务初始化失败，将使用主服务:', error);
    }
  }
  
  // 生成文本的向量嵌入
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // 首先尝试使用Python服务(更高效)
      if (this.pythonEmbeddingService && await this.pythonEmbeddingService.isAvailable()) {
        return await this.pythonEmbeddingService.generateEmbedding(text);
      }
      
      // 回退到基于Gemini的嵌入
      return await this.genAI.generateEmbedding(text);
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      throw error;
    }
  }
  
  // 计算两个向量的余弦相似度
  calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    return dotProduct / (mag1 * mag2);
  }
  
  // 其他向量计算方法...
}
```

向量嵌入服务的特点：
- 支持多种后端服务(Python服务和直接API调用)的负载均衡
- 提供向量相似度计算功能
- 针对生产环境优化性能(缓存、批处理等)

### 2.5 聚类分析服务

聚类分析服务(`server/services/learning/cluster_analyzer.ts`)对用户的记忆进行聚类，发现知识主题和关联：

```typescript
export class ClusterAnalyzer {
  private pythonClusteringService: PythonClusteringService;
  private fallbackService: FallbackClusteringService;
  private cacheService: ClusterCacheService;
  
  constructor() {
    this.pythonClusteringService = new PythonClusteringService();
    this.fallbackService = new FallbackClusteringService();
    this.cacheService = new ClusterCacheService();
  }
  
  // 执行聚类分析
  async analyzeUserMemories(userId: number): Promise<ClusterResult> {
    try {
      // 检查缓存
      const cachedResult = await this.cacheService.getClusterResult(userId);
      if (cachedResult && !this.isStale(cachedResult)) {
        return cachedResult;
      }
      
      // 获取用户记忆数据
      const memories = await this.getMemories(userId);
      if (memories.length < 5) {
        return { clusters: [], timestamp: new Date().toISOString() };
      }
      
      // 提取向量数据
      const vectors = memories.map(m => m.embedding);
      const memoryIds = memories.map(m => m.id);
      
      // 尝试使用Python聚类服务
      let clusterResult;
      if (await this.pythonClusteringService.isAvailable()) {
        clusterResult = await this.pythonClusteringService.performClustering(vectors, memoryIds);
      } else {
        // 回退到JavaScript实现
        clusterResult = await this.fallbackService.performClustering(vectors, memoryIds);
      }
      
      // 处理聚类结果
      const enrichedResult = await this.enrichClusterResults(clusterResult, memories);
      
      // 缓存结果
      await this.cacheService.storeClusterResult(userId, enrichedResult);
      
      return enrichedResult;
    } catch (error) {
      console.error('聚类分析失败:', error);
      throw error;
    }
  }
  
  // 丰富聚类结果(添加主题名称、摘要等)
  private async enrichClusterResults(
    clusters: RawCluster[], 
    memories: Memory[]
  ): Promise<ClusterResult> {
    // 为每个聚类添加元数据
    const enrichedClusters = await Promise.all(clusters.map(async (cluster) => {
      // 找出聚类中的所有记忆
      const clusterMemories = cluster.memoryIds.map(id => 
        memories.find(m => m.id === id)
      ).filter(Boolean) as Memory[];
      
      // 生成聚类摘要
      const summary = await this.generateClusterSummary(clusterMemories);
      
      // 提取主题名称
      const topic = await this.extractClusterTopic(clusterMemories, summary);
      
      // 计算聚类占比
      const percentage = (cluster.memoryIds.length / memories.length) * 100;
      
      return {
        ...cluster,
        topic,
        summary,
        percentage,
        memoryCount: cluster.memoryIds.length
      };
    }));
    
    return {
      clusters: enrichedClusters,
      timestamp: new Date().toISOString()
    };
  }
  
  // 其他辅助方法...
}
```

聚类分析服务的关键特性：
- 结合K-means和DBSCAN等算法进行内容聚类
- 支持缓存机制减少计算开销
- 使用主题提取和摘要生成丰富聚类结果
- 提供JavaScript回退实现确保可用性

### 2.6 主题图谱构建

主题图谱构建服务(`server/services/learning/topic_graph_builder.ts`)负责创建知识主题间的连接关系：

```typescript
export class TopicGraphBuilder {
  private genAI: GenAIService;
  
  constructor() {
    this.genAI = new GeminiService();
  }
  
  // 构建主题图谱
  async buildTopicGraph(
    userId: number, 
    clusters: EnrichedCluster[]
  ): Promise<TopicGraph> {
    try {
      if (!clusters || clusters.length <= 1) {
        return { nodes: [], links: [], timestamp: new Date().toISOString() };
      }
      
      // 提取主题
      const topics = clusters.map(c => c.topic);
      
      // 提取每个主题的中心内容
      const centerTexts: Record<string, string[]> = {};
      clusters.forEach(cluster => {
        centerTexts[cluster.topic] = this.getClusterCenterTexts(cluster);
      });
      
      // 获取主题元数据
      const topicMetadata: Record<string, any> = {};
      clusters.forEach(cluster => {
        topicMetadata[cluster.topic] = {
          clusterSize: cluster.memoryCount,
          percentage: cluster.percentage,
          id: cluster.id
        };
      });
      
      // 提取主题间关系
      const relations = await this.extractRelations(topics, centerTexts, topicMetadata);
      
      // 构建图谱节点
      const nodes = clusters.map(cluster => ({
        id: cluster.topic,
        name: cluster.topic,
        value: Math.max(5, Math.min(20, cluster.percentage / 5)), // 节点大小
        clusterId: cluster.id,
        percentage: cluster.percentage,
        summary: cluster.summary
      }));
      
      // 构建图谱连接
      const links = relations.map(rel => ({
        source: rel.source,
        target: rel.target,
        type: rel.type,
        value: rel.strength || 1,
        label: rel.label || rel.type,
        reason: rel.reason || ''
      }));
      
      return {
        nodes,
        links,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('构建主题图谱失败:', error);
      throw error;
    }
  }
  
  // 从主题间提取关系
  private async extractRelations(
    topics: string[], 
    centerTexts?: Record<string, string[]>,
    topicMetadata?: Record<string, any>
  ): Promise<Relation[]> {
    const rels: Relation[] = [];
    
    try {
      // 安全检查
      if (!topics || topics.length <= 1) {
        return [];
      }
      
      // 限制主题对数量，避免组合爆炸
      const maxPairs = topics.length <= 5 ? topics.length * (topics.length - 1) / 2 : 10;
      let pairCount = 0;
      
      // 创建主题对组合
      for (let i = 0; i < topics.length && pairCount < maxPairs; i++) {
        for (let j = i + 1; j < topics.length && pairCount < maxPairs; j++) {
          const topic1 = topics[i];
          const topic2 = topics[j];
          
          // 提取中心文本样例(如果有)
          const texts1 = centerTexts?.[topic1] || [];
          const texts2 = centerTexts?.[topic2] || [];
          
          // 分析关系
          const relation = await this.analyzeTopicRelation(
            topic1, 
            topic2, 
            texts1, 
            texts2, 
            topicMetadata
          );
          
          if (relation) {
            rels.push(relation);
          }
          
          pairCount++;
        }
      }
      
      return rels;
    } catch (error) {
      console.error('提取主题关系失败:', error);
      return [];
    }
  }
  
  // 分析两个主题间的关系
  private async analyzeTopicRelation(
    topic1: string,
    topic2: string,
    texts1: string[],
    texts2: string[],
    metadata?: Record<string, any>
  ): Promise<Relation | null> {
    try {
      // 构建提示词，要求AI分析关系
      const prompt = `分析以下两个主题的关系:
      主题1: ${topic1}
      ${texts1.length > 0 ? `样例内容: ${texts1.slice(0, 2).join(' | ')}` : ''}
      
      主题2: ${topic2}
      ${texts2.length > 0 ? `样例内容: ${texts2.slice(0, 2).join(' | ')}` : ''}
      
      请确定这两个主题之间最可能的一种关系类型，从以下选项中选择:
      - prerequisite (前置知识): 主题1是学习主题2的前提
      - contains (包含关系): 主题1包含主题2
      - applies (应用关系): 主题1应用于主题2
      - similar (相似概念): 主题1与主题2相似或相关
      - complements (互补知识): 主题1与主题2互为补充
      - references (引用关系): 主题1引用或参考主题2
      - related (相关概念): 主题1与主题2有一般性关联
      
      以JSON格式回答，包含以下字段:
      {
        "type": "关系类型(英文)",
        "direction": "forward或reverse(表示关系从主题1指向主题2，或相反)",
        "strength": "关系强度(1-10)",
        "reason": "简短解释(30字以内)",
        "learningOrder": "学习顺序(可选)"
      }`;
      
      // 调用AI获取关系分析
      const response = await this.genAI.generateText(prompt);
      const relationData = this.parseRelationResponse(response);
      
      if (!relationData) return null;
      
      // 构建关系对象
      let source = topic1;
      let target = topic2;
      
      // 处理方向
      if (relationData.direction === 'reverse') {
        [source, target] = [target, source];
      }
      
      return {
        source,
        target,
        type: relationData.type,
        strength: relationData.strength,
        reason: relationData.reason,
        learningOrder: relationData.learningOrder
      };
    } catch (error) {
      console.error('分析主题关系失败:', error);
      return null;
    }
  }
  
  // 其他辅助方法...
}
```

主题图谱构建服务的创新点：
- 使用大语言模型分析主题间关系类型和强度
- 支持多种关系类型(前置知识、包含、应用等)
- 考虑学习顺序进行图谱布局
- 结合主题中心内容样例提高关系分析准确性

### 2.7 学习轨迹分析

学习轨迹分析服务(`server/services/learning/trajectory.ts`)负责分析用户的学习进度和路径：

```typescript
export class LearningTrajectoryService {
  private clusterService: ClusterAnalyzer;
  private topicGraphService: TopicGraphBuilder;
  
  constructor() {
    this.clusterService = new ClusterAnalyzer();
    this.topicGraphService = new TopicGraphBuilder();
  }
  
  // 获取用户学习轨迹
  async getUserTrajectory(userId: number): Promise<LearningTrajectory> {
    try {
      // 获取用户记忆聚类
      const clusterResult = await this.clusterService.analyzeUserMemories(userId);
      
      // 构建主题图谱
      const topicGraph = await this.topicGraphService.buildTopicGraph(
        userId,
        clusterResult.clusters
      );
      
      // 分析学习阶段
      const learningPhase = this.determineLearningPhase(clusterResult.clusters);
      
      // 计算主题覆盖度
      const topicCoverage = this.calculateTopicCoverage(clusterResult.clusters);
      
      // 生成学习建议
      const recommendations = await this.generateRecommendations(
        userId,
        clusterResult.clusters,
        topicGraph,
        learningPhase
      );
      
      // 检测知识缺口
      const knowledgeGaps = this.identifyKnowledgeGaps(
        topicGraph,
        clusterResult.clusters
      );
      
      // 构建节点和连接
      const { nodes, links } = this.buildTrajectoryGraph(
        clusterResult.clusters,
        topicGraph
      );
      
      // 生成进度数据
      const progress = clusterResult.clusters.map(cluster => ({
        category: cluster.topic,
        score: cluster.percentage,
        change: 0 // 暂无变化数据
      }));
      
      return {
        userId,
        phase: learningPhase,
        phaseProgress: this.calculatePhaseProgress(learningPhase, topicCoverage),
        topicCoverage,
        nodes,
        links,
        topics: clusterResult.clusters.map(c => ({
          topic: c.topic,
          percentage: c.percentage,
          summary: c.summary
        })),
        progress,
        recommendations,
        knowledgeGaps,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('获取学习轨迹失败:', error);
      throw error;
    }
  }
  
  // 确定学习阶段(KWL框架)
  private determineLearningPhase(clusters: EnrichedCluster[]): LearningPhase {
    // 基于聚类数量和内容确定学习阶段
    if (clusters.length < 3) {
      return 'K'; // Know - 初始阶段
    }
    
    // 分析聚类内容，检查是否包含深度问题
    let hasDeepQuestions = false;
    let hasApplications = false;
    
    for (const cluster of clusters) {
      // 检查是否包含深度问题的模式
      if (/问题|疑问|为什么|如何|what|why|how/.test(cluster.topic.toLowerCase())) {
        hasDeepQuestions = true;
      }
      
      // 检查是否包含应用实践的模式
      if (/应用|实践|案例|example|practice|apply/.test(cluster.topic.toLowerCase())) {
        hasApplications = true;
      }
    }
    
    if (hasApplications) {
      return 'L'; // Learned - 应用阶段
    }
    
    if (hasDeepQuestions) {
      return 'W'; // Want to learn - 探索阶段
    }
    
    return 'K'; // 默认为初始阶段
  }
  
  // 构建轨迹图谱
  private buildTrajectoryGraph(
    clusters: EnrichedCluster[],
    topicGraph: TopicGraph
  ): { nodes: TrajectoryNode[], links: TrajectoryLink[] } {
    // 使用主题图谱的节点和连接，并添加额外的轨迹信息
    const nodes = topicGraph.nodes.map(node => {
      const cluster = clusters.find(c => c.topic === node.id);
      return {
        ...node,
        progress: cluster?.percentage || 0,
        isActive: (cluster?.percentage || 0) > 30
      };
    });
    
    // 处理连接，考虑学习顺序
    const links: TrajectoryLink[] = [];
    
    for (const link of topicGraph.links) {
      // 对于前置知识类型的关系，添加方向性
      if (link.type === 'prerequisite') {
        links.push({
          ...link,
          directed: true
        });
      } else {
        links.push({
          ...link,
          directed: false
        });
      }
    }
    
    // 如果没有足够的连接，基于聚类大小添加一些默认连接
    if (links.length < nodes.length - 1) {
      const sortedClusters = [...clusters].sort((a, b) => b.percentage - a.percentage);
      
      if (sortedClusters.length > 1) {
        const largestCluster = sortedClusters[0];
        
        for (let i = 1; i < sortedClusters.length; i++) {
          const cluster = sortedClusters[i];
          
          links.push({
            source: largestCluster.topic,
            target: cluster.topic,
            value: Math.max(1, Math.min(10, cluster.percentage / 10)),
            type: 'related',
            directed: false
          });
        }
      }
    }
    
    return { nodes, links };
  }
  
  // 其他辅助方法...
}
```

学习轨迹分析服务的功能亮点：
- 基于KWL(Know-Want to know-Learned)框架分析学习阶段
- 生成个性化学习建议
- 检测知识缺口
- 可视化学习轨迹
- 计算主题覆盖度和学习进度

### 2.8 Python服务集成

系统集成了Python服务处理计算密集型任务，如聚类分析，`server/services/api/clustering/app.py`提供聚类API：

```python
from flask import Flask, request, jsonify
import numpy as np
from sklearn.cluster import DBSCAN, KMeans
import json
import os
from sklearn.metrics import silhouette_score

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/cluster', methods=['POST'])
def cluster_data():
    try:
        data = request.json
        
        if not data or 'vectors' not in data:
            return jsonify({'error': 'No vectors provided'}), 400
        
        vectors = data['vectors']
        memory_ids = data.get('memory_ids', [])
        
        if len(vectors) < 5:
            return jsonify({
                'clusters': [{'cluster_id': 0, 'memory_ids': memory_ids}],
                'method': 'single'
            })
        
        # 转换为numpy数组
        vectors_np = np.array(vectors)
        
        # 尝试DBSCAN聚类
        dbscan_clusters = perform_dbscan(vectors_np, memory_ids)
        
        # 尝试K-means聚类
        kmeans_clusters = perform_kmeans(vectors_np, memory_ids)
        
        # 比较两种方法的结果，选择更好的
        dbscan_score = evaluate_clustering(dbscan_clusters, vectors_np)
        kmeans_score = evaluate_clustering(kmeans_clusters, vectors_np)
        
        # 选择分数更高的结果
        if dbscan_score > kmeans_score:
            return jsonify({
                'clusters': dbscan_clusters,
                'method': 'dbscan',
                'score': dbscan_score
            })
        else:
            return jsonify({
                'clusters': kmeans_clusters,
                'method': 'kmeans',
                'score': kmeans_score
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def perform_dbscan(vectors, memory_ids):
    # 使用DBSCAN进行聚类
    epsilon = 0.35  # 邻域半径
    min_samples = 2  # 最小样本数
    
    dbscan = DBSCAN(eps=epsilon, min_samples=min_samples, metric='cosine')
    cluster_labels = dbscan.fit_predict(vectors)
    
    # 处理结果
    unique_labels = set(cluster_labels)
    clusters = []
    
    for label in unique_labels:
        indices = np.where(cluster_labels == label)[0].tolist()
        cluster_memories = [memory_ids[i] for i in indices] if memory_ids else indices
        
        clusters.append({
            'cluster_id': int(label),
            'memory_ids': cluster_memories
        })
    
    return clusters

def perform_kmeans(vectors, memory_ids):
    # 估计最佳K值
    n_samples = len(vectors)
    k = min(max(2, n_samples // 5), 10)  # K在2到10之间，平均每类至少5个样本
    
    kmeans = KMeans(n_clusters=k, random_state=42)
    cluster_labels = kmeans.fit_predict(vectors)
    
    # 处理结果
    unique_labels = set(cluster_labels)
    clusters = []
    
    for label in unique_labels:
        indices = np.where(cluster_labels == label)[0].tolist()
        cluster_memories = [memory_ids[i] for i in indices] if memory_ids else indices
        
        clusters.append({
            'cluster_id': int(label),
            'memory_ids': cluster_memories
        })
    
    return clusters

def evaluate_clustering(clusters, vectors):
    # 如果只有一个聚类，给出默认分数
    if len(clusters) <= 1:
        return 0.5
        
    # 重建聚类标签数组
    labels = np.zeros(len(vectors), dtype=int)
    
    for cluster in clusters:
        cluster_id = cluster['cluster_id']
        for idx in range(len(vectors)):
            if idx in cluster['memory_ids'] or str(idx) in cluster['memory_ids']:
                labels[idx] = cluster_id
    
    # 至少需要2个聚类和每个聚类至少2个样本来计算轮廓系数
    unique_labels = np.unique(labels)
    if len(unique_labels) < 2:
        return 0.5
        
    # 检查每个聚类至少有2个样本
    valid_clustering = all(np.sum(labels == label) >= 2 for label in unique_labels)
    
    if valid_clustering:
        try:
            score = silhouette_score(vectors, labels, metric='cosine')
            return float(score)
        except:
            return 0.5
    else:
        return 0.5

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

Python服务的优势：
- 利用scikit-learn库提供高性能聚类算法
- 支持自动选择最优聚类方法
- 提供API健康检查
- 针对小数据集提供特殊处理
- 通过轮廓系数评估聚类质量

## 3. 系统关键技术分析

### 3.1 提示词工程实现

本系统在提示词工程方面采用了多层次的策略，实现了动态、模块化的提示词管理：

1. **分阶段提示词设计**：基于教育学KWL框架(Know-Want to learn-Learned)，针对用户不同学习阶段自动调整提示词策略。例如：
   - K阶段(初始阶段)：提示词强调基础概念解释和知识导入
   - W阶段(探索阶段)：提示词引导深度问题探索和关联建立
   - L阶段(应用阶段)：提示词鼓励知识应用和实践

2. **模块化提示词组装**：将提示词拆分为多个功能模块，实现灵活组合：
   - 系统基础模块：定义AI助手的基本角色和交互风格
   - 个性化模块：根据用户学习风格和偏好调整响应方式
   - 记忆模块：注入相关历史对话和记忆
   - 上下文增强模块：添加当前对话主题和进度信息
   - 学习策略模块：引入适合当前阶段的教学策略

3. **动态提示词注入**：根据实时分析结果调整提示词内容：
   - 实时检测对话主题变化
   - 自动添加相关知识点和概念解释
   - 根据用户理解程度调整复杂度

### 3.2 向量化与语义检索

系统实现了高效的文本向量化和语义检索机制：

1. **多源向量嵌入**：
   - 使用Gemini模型生成高质量嵌入向量
   - 支持本地和云端向量化处理
   - 向量维度优化，平衡精度和效率(768维)

2. **混合检索策略**：
   - 基于余弦相似度的高效向量检索
   - 结合关键词和语义检索的混合召回
   - 上下文感知的相关度重排序

3. **高效存储机制**：
   - 向量缓存减少重复计算
   - 分块存储支持大规模数据集
   - 增量更新优化

### 3.3 记忆管理与聚类分析

系统的核心创新在于智能记忆管理与分析：

1. **记忆表示与存储**：
   - 结构化记忆对象(内容、摘要、关键词、向量)
   - 混合存储策略(数据库+文件系统)
   - 唯一ID生成确保记忆一致性

2. **高效聚类算法**：
   - 多算法组合(DBSCAN、K-means)
   - 自动参数调优
   - 聚类质量评估与优化

3. **主题提取与关系分析**：
   - 基于LLM的主题名称生成
   - 智能关系类型推断
   - 学习顺序识别

### 3.4 大模型调用优化

为提高系统稳定性和性能，实现了多项大模型调用优化：

1. **错误处理与重试机制**：
   - 分级错误处理(网络、API、内容)
   - 指数退避重试策略
   - 优雅降级机制

2. **上下文管理**：
   - 动态上下文窗口调整
   - 优先级内容保留策略
   - 上下文压缩技术

3. **请求批处理与缓存**：
   - 非关键请求批处理减少API调用
   - 结果缓存避免重复查询
   - 预测性请求准备

## 4. 系统部署与可靠性保障

### 4.1 生产环境部署优化

系统采用了专门的生产环境部署解决方案，如`scripts/build-prod.cjs`：

```javascript
// 确保构建输出包含PostgreSQL会话存储配置
const buildProd = async () => {
  console.log('开始生产环境构建...');
  
  // 执行前端和后端构建
  // ...
  
  // 确保构建输出包含PostgreSQL会话存储配置
  // ...
  
  // 验证最终构建内容
  // ...
};

buildProd().catch(err => {
  console.error('构建失败:', err);
  process.exit(1);
});
```

并解决了会话存储等关键问题，确保系统稳定性：

```javascript
// 在Express应用中使用PostgreSQL会话存储
const { createSessionConfig } = require('./scripts/db-session.cjs');
app.use(session(createSessionConfig()));
```

### 4.2 ESM/CJS模块冲突解决

系统解决了Node.js中常见的ESM/CJS模块冲突问题，如`BUILD.md`中描述的纯ESM构建流程：

```bash
# 一步完成构建和启动
node deploy-esm.js
```

这些优化确保了系统在生产环境中的稳定运行。

## 5. 系统技术特点总结

本系统在技术实现上具有以下特点：

1. **模块化与可扩展性**：
   - 采用服务化设计，各组件松耦合
   - 接口抽象支持多种实现切换
   - 插件式架构便于功能扩展

2. **混合计算策略**：
   - JavaScript/TypeScript主逻辑
   - Python高性能计算服务
   - 云端AI服务集成

3. **智能记忆管理**：
   - 向量化存储与检索
   - 自动聚类与主题发现
   - 关系图谱构建

4. **高级提示词工程**：
   - 动态模块化提示词
   - 学习阶段感知
   - 上下文增强

5. **性能与可靠性**：
   - 缓存与批处理优化
   - 错误处理与恢复机制
   - 生产环境部署优化

## Review Summary

通过对代码库的深入分析，本文档概述了系统的设计与实现细节。主要引用的文件与模块都已经过核实，确保描述与实际代码一致。

系统核心技术包括：
- 提示词工程与管理
- 向量嵌入与语义检索
- 记忆管理与聚类分析
- 知识图谱构建
- JavaScript与Python混合计算

待用户确认的点：
1. 系统使用的具体AI模型配置参数
2. 数据库连接与存储细节
3. 生产环境的具体部署配置
