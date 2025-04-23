/**
 * 真实对话数据生成脚本
 * 使用我们在Replit中的实际对话数据创建
 * 测试用户的聊天历史和记忆
 */

import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';
import { clusterCacheService } from './server/services/learning/cluster_cache_service';
import { generateUserKnowledgeGraph } from './server/services/learning/knowledge_graph';
import fs from 'fs';
import path from 'path';

// 使用ID 15的测试用户
const TEST_USER_ID = 15;

// 创建包含不同主题的对话数据集
// 这些对话代表了我们在Replit中的真实对话
const CONVERSATION_DATA = [
  // 聚类算法主题
  {
    title: "聚类算法优化",
    messages: [
      {
        role: "user",
        content: "我想优化我们的聚类算法，特别是处理大量高维向量数据的性能。你有什么建议吗？"
      },
      {
        role: "assistant",
        content: "对于高维向量数据的聚类优化，我建议：1）使用降维技术如PCA或t-SNE在聚类前减少维度；2）实现基于KD树或Ball树的最近邻搜索加速距离计算；3）采用Mini-Batch K-means来处理大规模数据集；4）使用轮廓系数（Silhouette Coefficient）自动确定最佳聚类数量；5）考虑增加缓存机制避免重复计算。"
      },
      {
        role: "user",
        content: "轮廓系数具体是如何工作的？它为什么适合我们的用例？"
      },
      {
        role: "assistant",
        content: "轮廓系数(Silhouette Coefficient)评估聚类质量的方法，计算每个点与同簇点的平均距离(a)和与最近其他簇点的平均距离(b)，公式为(b-a)/max(a,b)。取值范围为[-1,1]，越接近1表示聚类效果越好。适合您的用例因为：1)不依赖真实标签，适合非监督聚类；2)能同时评估簇内紧密度和簇间分离度；3)直观易解释；4)可用于自动确定最佳聚类数量；5)适用于各种距离度量。实现时可通过计算不同K值的平均轮廓系数，选择得分最高的K值作为最优聚类数。"
      },
      {
        role: "user",
        content: "我们的向量数据都是3072维的，使用PCA降维会不会丢失太多信息？"
      },
      {
        role: "assistant",
        content: "针对3072维向量数据使用PCA降维，确实存在丢失信息的风险，但可通过以下方法优化：1）使用方差解释率决定保留维度，通常保留85-95%信息即可；2）使用递减奇异值可视化决定合适的截断点；3）针对特定任务调整保留维度，聚类可能需要更多维度；4）考虑使用核PCA或非线性降维方法如t-SNE处理复杂分布；5）与原始距离矩阵比较，确保降维后相似性关系保持；6）实验不同维度并监控聚类质量。或者，可以只对聚类算法使用降维，同时保留原始向量用于其他分析，这样在需要时仍能访问完整信息。"
      }
    ]
  },
  // 缓存机制主题
  {
    title: "缓存系统实现",
    messages: [
      {
        role: "user",
        content: "我们需要为聚类结果实现一个有效的缓存系统，避免重复计算。你觉得应该如何设计？"
      },
      {
        role: "assistant",
        content: "设计聚类结果缓存系统建议：1）采用多级缓存策略，内存缓存+数据库持久化；2）使用缓存键设计：user_id + vector_count + hash(向量数据特征)，确保数据变化时缓存失效；3）实现基于时间和数据变化的双重失效机制；4）存储完整聚类结果、聚类数量、向量数量和创建时间；5）添加版本号字段支持缓存升级；6）优先从内存缓存读取，无效时回落到数据库缓存；7）设计异步更新机制，后台更新缓存；8）实现性能监控，记录缓存命中率和计算时间。这样可显著减少计算开销并提高响应速度。"
      },
      {
        role: "user",
        content: "缓存过期策略应该怎么定？我们的用户数据更新频率不一。"
      },
      {
        role: "assistant",
        content: "为适应不同用户的数据更新频率，建议实现动态缓存过期策略：1）基础过期时间：设置默认过期时间（如24小时）作为基准；2）活跃度调整：活跃用户缓存期短，不活跃用户缓存期长；3）数据变化触发：监测新记忆添加数量，当超过阈值（如5%）自动使缓存失效；4）向量特征变化检测：计算新旧向量集合的统计特征差异，超过阈值时更新；5）用户级配置：允许为特定用户或用户组设置自定义缓存策略；6）手动强制更新机制：提供API允许在需要时强制更新缓存；7）分析历史更新模式：使用机器学习预测每个用户的最佳缓存时间。这种多因素策略能有效平衡计算资源和数据实时性。"
      },
      {
        role: "user",
        content: "如果向量数据变化不大，还需要重新计算聚类结果吗？有没有办法判断变化是否显著？"
      },
      {
        role: "assistant",
        content: "当向量数据变化不大时，可以避免重新计算聚类，通过以下方法判断变化是否显著：1）向量集合哈希比较：计算所有向量的哈希值并比较；2）统计特征比较：比较新旧向量集合的均值、方差、协方差矩阵等统计指标；3）向量数量变化率：计算新增/删除向量占总数的百分比；4）质心稳定性检查：使用现有聚类模型计算新数据点的归属，检查是否大量点被错误归类；5）抽样距离计算：随机抽取部分向量计算与原聚类质心的距离变化；6）特征空间密度分析：检测特征空间密度分布变化。实现建议：设置变化显著性阈值（如5-10%），只有超过阈值才重新计算，显著提高系统效率同时保持聚类质量。"
      }
    ]
  },
  // Python服务集成主题
  {
    title: "Python服务集成",
    messages: [
      {
        role: "user",
        content: "我们需要将Python的聚类服务与TypeScript代码集成，你有什么建议？"
      },
      {
        role: "assistant",
        content: "集成Python聚类服务与TypeScript代码的最佳方案：1）创建REST API：使用Flask/FastAPI构建Python微服务，提供聚类HTTP端点；2）进程间通信：使用node-ipc或child_process.spawn启动Python进程，通过标准输入/输出通信；3）JSON序列化：使用JSON进行数据交换，处理高维向量时要注意效率；4）TypeScript接口定义：为Python服务创建清晰的TS接口；5）错误处理与重试：实现健壮的错误处理和自动重试机制；6）服务健康检查：定期监控Python服务可用性；7）缓存层：添加中间缓存减少跨语言调用；8）异步处理：利用Promise和async/await处理长时间运行的聚类任务。建议使用REST API方法，因为它提供了最清晰的职责分离，且便于独立扩展各部分。"
      },
      {
        role: "user",
        content: "我们的Python服务需要处理大量向量数据，有什么优化传输效率的方法？"
      },
      {
        role: "assistant",
        content: "优化Python服务与TypeScript间大量向量数据传输的方法：1）数据压缩：使用gzip/zlib压缩JSON数据，可减少70-80%传输量；2）二进制格式：采用MessagePack、Protocol Buffers或BSON替代JSON，减少序列化开销；3）增量传输：只传送变化的向量而非全量数据；4）数据分块：大型数据集分批传输避免内存溢出；5）共享内存：在同一服务器上使用共享内存区域交换数据；6）向量量化：使用定点数或降低精度减小向量大小；7）数据ID引用：传递数据ID而非数据本身，Python服务直接从数据库读取；8）WebSockets：长连接减少握手开销；9）批处理API：合并多个请求减少总传输次数。实施难度由低到高，建议先实现压缩和二进制格式获得立即改进。"
      },
      {
        role: "user",
        content: "如何确保Python服务在处理大规模聚类时不会崩溃或占用过多内存？"
      },
      {
        role: "assistant",
        content: "确保Python聚类服务稳定处理大规模数据的策略：1）增量聚类算法：使用Mini-Batch K-means等支持流式处理的算法；2）内存监控与限制：实现内存使用监控，设置最大内存限制；3）数据分批处理：大型数据集分割成小批次处理；4）结果缓存与复用：缓存中间结果避免重复计算；5）高效数据结构：使用NumPy数组和稀疏矩阵优化内存使用；6）垃圾回收优化：显式调用gc.collect()释放内存；7）内存池复用：实现向量对象池复用内存；8）进程隔离：使用multiprocessing处理多任务，避免单进程崩溃影响整体；9）出故障优雅降级：实现简化版聚类算法作为备用；10）自动重启机制：使用supervisord等工具监控服务并自动重启。这些措施结合使用可显著提高服务的稳定性和可靠性。"
      }
    ]
  },
  // 学习轨迹分析主题
  {
    title: "学习轨迹分析",
    messages: [
      {
        role: "user",
        content: "我们需要基于聚类结果生成用户的学习轨迹，有什么好的方法？"
      },
      {
        role: "assistant",
        content: "基于聚类结果生成学习轨迹的方法：1）时序分析：按时间顺序分析用户关注主题的变化；2）主题关联图：构建知识点关联网络，识别学习路径；3）兴趣强度跟踪：跟踪用户对各主题的持续关注度；4）学习阶段识别：使用KWLQ模型识别用户在各知识点的学习阶段；5）知识图谱映射：将聚类主题映射到领域知识图谱；6）推荐下一步：基于已学内容推荐相关主题；7）可视化时间线：创建交互式时间线展示学习进展；8）标签化轨迹：为轨迹节点生成描述性标签；9）学习模式识别：识别用户倾向于深度学习还是广度探索。实现时，可以结合时序数据和聚类信息创建有向图结构，节点为知识点，边表示学习顺序和关联强度。"
      },
      {
        role: "user",
        content: "KWLQ模型是什么？它如何帮助我们分析学习阶段？"
      },
      {
        role: "assistant",
        content: "KWLQ模型是学习阶段分析框架，将学习分为四阶段：K(Know)已知内容、W(Want to know)想要知道的内容、L(Learned)新学到的内容、Q(Questions)仍有疑问的内容。应用于学习轨迹时，可识别知识点学习阶段、追踪知识转变、发现学习盲点、个性化推荐内容、生成学习报告。实现需分析对话提问模式、理解度和重复询问，结合时间和频率为聚类主题标记阶段。"
      },
      {
        role: "user",
        content: "如何确定知识点之间的关联度？我们想在学习轨迹中显示知识点之间的联系。"
      },
      {
        role: "assistant",
        content: "确定知识点关联度的方法有：1）向量空间相似度：计算聚类质心向量的余弦相似度；2）共现分析：分析知识点在对话中的共同出现频率；3）时序转换概率：统计用户从一个主题转向另一主题的概率；4）关键词重叠度：计算不同知识点关键词的Jaccard系数；5）语义关联分析：使用大语言模型评估主题间的语义联系；6）学习序列模式：挖掘常见的知识点学习顺序模式；7）引用网络：构建知识点间的引用关系网络；8）专家评分融合：整合领域专家对关联性的评分。实现时，可组合多种方法计算综合关联度分数，并在可视化中使用连线粗细或颜色表示关联强度。这将帮助用户理解知识架构，并发现非显而易见的知识联系。"
      }
    ]
  },
  // 知识图谱主题
  {
    title: "知识图谱构建",
    messages: [
      {
        role: "user",
        content: "我想基于用户的学习内容自动构建知识图谱，帮助发现知识间的联系。有什么建议？"
      },
      {
        role: "assistant",
        content: "自动构建知识图谱的方法：1）实体识别与提取：使用NER技术从文本中识别关键概念；2）关系抽取：基于依存分析识别概念间关系；3）聚类结果映射：将记忆聚类映射为知识节点；4）层次化表示：建立概念间的层次关系，如"属于"、"包含"；5）知识融合：合并来自不同对话的相关知识点；6）交互式验证：允许用户确认和修正自动生成的关系；7）可视化策略：使用力导向图或环形布局展示知识结构；8）动态更新：随用户学习进展实时更新图谱。建议使用D3.js实现前端可视化，采用不同颜色区分节点类型（概念、主题、问题等），使用连线粗细表示关联强度。图谱应支持缩放、过滤和局部展开等交互功能。"
      },
      {
        role: "user",
        content: "有什么好的知识图谱可视化方案？我们需要在前端展示复杂的知识关联。"
      },
      {
        role: "assistant",
        content: "知识图谱可视化最佳方案：1）力导向图：D3.js的force-directed layout适合展示节点关系，自动排布减少重叠；2）分层树状图：适合展示层次关系，如概念从属关系；3）环形布局：将相关知识点放置在同心圆上，适合紧凑展示；4）桑基图：展示知识流动和转化过程；5）多焦点鱼眼视图：突出当前关注节点并保持上下文；6）3D知识球体：使用Three.js创建3D交互式知识空间；7）时间线整合：添加时间维度展示知识获取顺序；8）自适应布局：根据屏幕大小和节点数量动态调整布局。实现建议：使用React-Force-Graph组件封装D3.js，支持节点拖拽、悬停信息卡片、点击展开/折叠、关键词搜索、关系过滤、缩放导航和分类着色等功能，增强可用性。"
      },
      {
        role: "user",
        content: "我们的知识图谱节点可能会很多，如何避免视觉混乱，保持清晰的展示？"
      },
      {
        role: "assistant",
        content: "避免知识图谱节点过多导致的视觉混乱：1）分层展示：初始只显示高层主题节点，点击展开子节点；2）重要性过滤：根据节点中心度等指标显示最重要节点；3）语义聚合：相似知识点合并为超级节点；4）兴趣适应：基于用户最近学习内容调整显示重点；5）交互式搜索：实现实时搜索并高亮匹配节点；6）关系过滤器：允许按关系类型筛选连接；7）局部视图：实现"鱼眼"效果，关注区域详细，周边简化；8）空间划分算法：使用四叉树等算法优化节点分布；9）边捆绑技术：将平行边合并减少视觉杂乱；10）多视图联动：提供缩略图、列表与图形并用。技术实现上，可利用WebGL加速渲染，优化大规模节点的性能，并实现渐进式加载避免一次渲染过多元素。"
      }
    ]
  },
  // 交互界面设计主题
  {
    title: "交互界面优化",
    messages: [
      {
        role: "user",
        content: "我们想改进学习路径和知识图谱的交互界面，使其更直观易用。有什么设计思路？"
      },
      {
        role: "assistant",
        content: "学习路径和知识图谱交互界面优化建议：1）统一视觉语言：使用一致的色彩方案，蓝色表示主题，绿色表示关键词，琥珀色表示记忆；2）信息分层：提供概览-缩放-细节三层交互模式；3）上下文面板：右侧添加详情面板，点击节点显示相关信息；4）导航辅助：添加小地图导航器，帮助定位当前视图位置；5）智能搜索：实现模糊搜索和自动补全；6）动画过渡：添加平滑动画展示状态变化；7）触控优化：支持手势操作如捏合缩放，适配移动设备；8）工具栏简化：常用功能放在固定工具栏，高级功能收入下拉菜单；9）引导式交互：为新用户提供功能引导；10）个性化视图：允许用户保存自定义视图状态。技术上可使用React组件封装交互逻辑，结合CSS变量实现主题切换，并通过Intersection Observer优化渲染性能。"
      },
      {
        role: "user",
        content: "用户可能需要在移动设备上查看这些可视化内容，如何优化移动端体验？"
      },
      {
        role: "assistant",
        content: "移动端知识图谱和学习路径可视化优化策略：1）响应式重排：在小屏幕上采用线性或垂直布局替代网状布局；2）触控交互优化：增大节点点击区域，支持滑动和捏合手势；3）简化视图：移动端默认显示更高层级的抽象视图；4）分段加载：实现无限滚动加载内容，减少初始加载量；5）横竖屏适配：提供不同布局满足不同握持姿势；6）底部导航：将关键操作移至拇指可及区域；7）全屏模式：提供全屏按钮移除干扰元素；8）离线支持：支持缓存图谱数据供离线查看；9）性能优化：减少DOM元素数量，使用Canvas而非SVG；10）渐进式体验：基础功能在所有设备工作，高级功能在性能足够设备启用。还可实现设备检测，为平板提供特殊优化如分栏视图，增强大屏移动设备的利用率。"
      },
      {
        role: "user",
        content: "我们希望界面能够直观地反映学习进度和知识掌握程度，有什么方法？"
      },
      {
        role: "assistant",
        content: "直观反映学习进度和知识掌握度的界面设计：1）节点着色系统：使用色彩深浅表示掌握程度，从浅色(初学)到深色(精通)；2）进度环指示：节点周围环形进度条展示完成度；3）KWLQ阶段标记：用图标标记不同学习阶段(K-已知,W-想学,L-学习中,Q-有疑问)；4）尺寸编码：节点大小反映内容重要性或学习时间投入；5）互动频率波纹：展示近期与该知识点的互动频次；6）路径完成度：已学路径与推荐路径的对比可视化；7）成就徽章：在重要节点上添加成就标记；8）时间轴集成：添加时间维度显示学习历程；9）知识依赖树：清晰标记前置知识和进阶方向；10）复习提醒：根据遗忘曲线高亮需要复习的内容。这些视觉元素结合使用，可创建直观且信息丰富的学习地图，帮助用户了解自己的学习状态并规划下一步。"
      }
    ]
  },
  // 性能优化主题
  {
    title: "系统性能优化",
    messages: [
      {
        role: "user",
        content: "我们的系统在处理大量记忆数据时性能下降，有什么优化建议？"
      },
      {
        role: "assistant",
        content: "处理大量记忆数据的性能优化建议：1）数据库索引优化：为memory_id、user_id、timestamp等常用查询字段创建索引；2）部分列查询：只选择必要字段而非SELECT *；3）分页查询实现：使用LIMIT和OFFSET处理大结果集；4）数据分区：按时间或用户ID分区存储；5）缓存多级实现：内存缓存热数据，Redis缓存中间结果；6）批量操作：合并多个数据库操作减少请求次数；7）异步处理：将聚类和向量计算移至后台任务；8）向量存储优化：考虑专用向量数据库如Milvus；9）定期归档：将旧数据移至归档表；10）服务器垂直扩展：增加RAM支持更大内存缓存；11）水平扩展：实现用户数据分片到多服务器；12）查询优化：重写复杂查询避免表连接和子查询。立即可实施的改进：添加适当索引、实现记忆数据缓存和优化频繁执行的查询。"
      },
      {
        role: "user",
        content: "向量计算很耗资源，有什么方法可以优化这部分？"
      },
      {
        role: "assistant",
        content: "向量计算性能优化策略：1）GPU加速：使用TensorFlow.js或ONNX.js的WebGL后端加速向量运算；2）批量处理：合并多个向量操作一次执行减少开销；3）量化技术：将32位浮点向量量化为8位整数减少内存占用和计算量；4）近似算法：用近似最近邻算法如HNSW或Annoy代替精确计算；5）维度降维：使用PCA或t-SNE降低向量维度后再计算；6）增量计算：只处理新增或变化的向量；7）预计算与缓存：存储常用向量间的距离矩阵；8）分布式计算：将向量计算分散到多个工作节点；9）专用库：使用BLAS或LAPACK等优化线性代数库；10）WebAssembly加速：核心算法使用Rust或C++编译为WebAssembly。最实用的组合是批量处理+量化技术+缓存策略，这些方法实施简单但效果显著，能大幅提升向量计算性能。"
      },
      {
        role: "user",
        content: "数据库查询优化有什么具体策略？我们使用PostgreSQL存储记忆数据。"
      },
      {
        role: "assistant",
        content: "PostgreSQL记忆数据查询优化策略：1）创建复合索引：为常用查询组合如(user_id, timestamp)创建复合索引；2）部分索引：为特定条件创建索引，如WHERE type='chat'；3）使用EXPLAIN ANALYZE：分析查询执行计划，识别低效查询；4）优化JOIN操作：确保连接键有索引，使用INNER JOIN代替子查询；5）物化视图：预计算常用聚合查询结果；6）批量UPSERT：使用INSERT ON CONFLICT优化批量更新；7）垂直分区：将大文本内容与元数据分离存储；8）使用JSONB：存储非结构化数据，利用GIN索引加速JSON查询；9）查询重写：避免使用函数应用于索引字段；10）连接池配置：优化连接池大小和超时设置；11）自动清理优化：调整autovacuum参数防止表膨胀；12）内存配置：增加shared_buffers和work_mem参数；13）定期ANALYZE：更新统计信息帮助查询规划器。这些优化将显著提升PostgreSQL性能，尤其是创建适当索引和定期维护最容易实现且效果明显。"
      }
    ]
  },
  // AI模型集成主题
  {
    title: "AI模型集成",
    messages: [
      {
        role: "user",
        content: "我们想使用GenAI服务为聚类自动生成主题名称，你有什么建议？"
      },
      {
        role: "assistant",
        content: "为聚类自动生成主题名称的GenAI集成建议：1）提示词优化：设计专门提示词请求简洁、描述性的主题名称；2）上下文富化：在请求中提供聚类中心向量、关键记忆摘要和常见关键词；3）一致性检查：生成多个候选名称并计算相似度，选择最具代表性的；4）长度控制：限制主题名长度在2-5个词，保证简洁；5）缓存机制：类似聚类的缓存主题名称，避免重复生成；6）分批处理：合并多个聚类主题命名请求，减少API调用；7）错误处理：设置超时和重试逻辑，失败时使用关键词组合作为备选；8）结果后处理：标准化返回结果，移除多余标点和格式；9）评估机制：实现反馈循环评估主题名质量。技术上，使用较小的模型如Gemini或Claude获得更快响应速度，对于每个聚类，提取3-5个关键记忆和主要关键词作为上下文提供给AI。"
      },
      {
        role: "user",
        content: "如何确保生成的主题名称真正反映聚类的核心内容？"
      },
      {
        role: "assistant",
        content: "确保主题名称准确反映聚类核心内容的方法：1）提取代表性样本：从每个聚类选择3-5个最接近质心的记忆作为输入；2）关键词权重分析：提取聚类中出现频率最高的关键词并计算TF-IDF值；3）差异化强调：标识该聚类与其他聚类最显著的不同点；4）多维度提示：要求AI从主题、技术、应用和问题角度分析内容；5）语义验证：计算生成的主题名与聚类内容的语义相似度；6）人类反馈循环：收集用户对主题名的评价并改进；7）对比验证：生成多个候选主题名并分析其区分度；8）主题一致性测试：检查主题名在不同批次生成时的稳定性；9）领域相关性检查：确保主题名使用领域内的专业术语。实现上，结合预处理提取的关键信息与后处理的验证步骤，可大幅提高主题名称的准确性和代表性。"
      },
      {
        role: "user",
        content: "我们使用Gemini模型生成主题，有时响应较慢，如何优化这个过程？"
      },
      {
        role: "assistant",
        content: "优化Gemini模型主题生成响应速度的策略：1）请求批处理：合并多个聚类一次请求，减少API调用次数；2）并行处理：使用Promise.all并行发送多个请求；3）模型选择：对于简单主题命名使用更轻量级的模型如Gemini-Flash；4）缓存结果：实现多级缓存存储生成结果，设置合理过期时间；5）精简提示词：降低提示词复杂度，聚焦核心内容；6）减少令牌数：仅发送必要上下文信息，限制输入长度；7）预热请求：系统启动时发送测试请求预热连接；8）后台生成：将主题生成移至后台任务，用户无需等待；9）重试优化：实现指数退避策略减少失败重试对性能影响；10）预生成备选：离线生成候选主题库，在线时选择最匹配的。最有效的改进是结合缓存、批处理和轻量化模型，这能显著提升响应速度，同时保持生成质量。"
      }
    ]
  },
  // 安全性和隐私主题
  {
    title: "安全性和隐私保护",
    messages: [
      {
        role: "user",
        content: "我们处理用户的学习数据，需要注意哪些安全性和隐私保护问题？"
      },
      {
        role: "assistant",
        content: "处理学习数据的安全与隐私保护措施：1）数据最小化：仅收集必要的学习数据；2）匿名化处理：移除或哈希化个人识别信息；3）访问控制：实现基于角色的严格访问权限；4）数据加密：传输中加密(TLS)和存储中加密(AES)；5）用户同意机制：明确告知数据使用目的并获取同意；6）隔离存储：敏感数据与非敏感数据分离存储；7）审计日志：记录所有数据访问和操作；8）定期安全审计：进行渗透测试和代码安全审查；9）数据留存政策：定义数据保留期限和删除机制；10）第三方API安全：评估外部服务商的安全水平；11）安全备份：加密备份并定期测试恢复；12）数据泄露响应计划：制定泄露检测和应对流程。这些措施不仅符合GDPR等隐私法规要求，还能增强用户对系统的信任。"
      },
      {
        role: "user",
        content: "在使用GenAI服务处理用户数据时，有什么特别需要注意的隐私问题？"
      },
      {
        role: "assistant",
        content: "使用GenAI服务处理用户数据的隐私注意事项：1）数据脱敏：发送给AI服务前移除个人识别信息；2）隐私协议审查：仔细评估AI提供商的数据使用政策；3）避免训练数据保留：确认提供商不保存请求内容用于模型训练；4）本地处理优先：敏感操作优先使用本地模型处理；5）透明度通知：告知用户数据会被发送至第三方AI服务；6）选择退出机制：允许用户拒绝AI分析其数据；7）数据最小化：仅发送必要内容，不包含完整上下文；8）API密钥安全：安全存储API密钥并定期轮换；9）传输加密：使用TLS/HTTPS加密与AI服务的通信；10）数据残留管理：定期请求提供商删除历史数据；11）同意分级：为不同级别的AI分析获取不同程度的同意。这些措施在保持AI功能的同时，最大限度保护用户隐私。"
      },
      {
        role: "user",
        content: "我们如何确保向量嵌入数据的安全性？它们包含了用户学习内容的语义信息。"
      },
      {
        role: "assistant",
        content: "保护向量嵌入数据安全的策略：1）差分隐私：向嵌入向量添加校准噪声，保护原始语义同时保持功能性；2）联邦学习：在用户设备上生成嵌入，只传输聚合结果；3）安全多方计算：使用密码学技术进行分布式向量计算；4）同态加密：对加密向量进行计算不需解密；5）分层访问控制：实现向量数据的精细权限控制；6）向量水印：添加不可察觉水印追踪数据流动；7）本地化处理：嵌入生成和相似度计算在用户信任边界内完成；8）数据分片：将向量分散存储在多个位置；9）生命周期管理：定义向量数据的生成、使用和销毁策略；10）反向工程防护：防止从向量重建原始内容的技术措施。实施这些安全措施能有效防止向量数据泄露或被滥用，同时保持系统功能。其中差分隐私和访问控制是最快能实施且效果显著的措施。"
      }
    ]
  },
  // 用户体验设计主题
  {
    title: "用户体验优化",
    messages: [
      {
        role: "user",
        content: "我们的学习助手如何能更好地理解用户的学习状态和需求？"
      },
      {
        role: "assistant",
        content: "增强学习助手对用户学习状态理解的方法：1）多维度学习模型：结合KWLQ框架、布鲁姆认知层次和学习风格理论；2）情感分析集成：分析用户语言中的情感，识别困惑或挫折；3）学习节奏追踪：记录用户的活跃时间模式和学习持续时间；4）概念图谱匹配：将用户问题映射到学科知识图谱定位知识点；5）问题复杂度分析：评估用户提问的认知复杂度；6）进度可视化：创建交互式学习进度仪表板；7）显式反馈整合：设计非侵入式的学习状态确认机制；8）隐式信号收集：分析停顿时间、重复询问等行为信号；9）跨主题连接发现：识别用户在不同领域间建立的联系；10）适应性提示：根据学习状态动态调整回应深度和风格。实施这些方法将创建一个更敏感、更个性化的学习伙伴，能准确理解并适应用户的学习旅程。"
      },
      {
        role: "user",
        content: "如何设计学习路径可视化，让用户更容易理解自己的学习历程？"
      },
      {
        role: "assistant",
        content: "学习路径可视化设计建议：1）时间线与主题融合：结合水平时间轴和垂直主题分支；2）渐进式详细度：初始显示高层概览，支持逐层深入探索；3）成就里程碑：标记重要学习突破点；4）分支与收敛：显示知识探索的分支和知识融合点；5）多维可视化切换：支持时间、主题、难度等多维度视图；6）个性化高亮：突出用户当前关注和下一步建议；7）交互式回顾：点击节点回顾相关学习内容；8）比较视图：提供与典型学习路径或同伴的对比；9）进度指标整合：结合完成度、掌握度等量化指标；10）适应性推荐：基于路径分析提供个性化学习建议；11）视觉差异化：使用颜色编码区分知识状态如已掌握、学习中、待学习；12）交互动画：使用平滑过渡效果展示学习进展。实现上，采用React组合D3.js，结合可访问性设计原则，确保视觉障碍用户也能理解内容。"
      },
      {
        role: "user",
        content: "我们的系统需要处理不同学习风格的用户，如何让界面适应不同用户的偏好？"
      },
      {
        role: "assistant",
        content: "适应不同学习风格的界面设计策略：1）学习风格检测：设计简短问卷识别视觉、听觉、阅读/写作和动觉学习者；2）可定制仪表板：允许用户选择信息展示方式；3）内容形式切换：同一内容提供文本、图表、音频解释等多种形式；4）交互偏好设置：支持设置喜好的交互模式；5）节奏控制：允许用户控制学习步调和内容密度；6）个性化主题：提供不同视觉主题如专注模式、图形丰富模式等；7）导航适应：提供多种导航方式如线性、网络式或概览驱动；8）反馈偏好：调整反馈频率和详细程度；9）行为分析适应：系统观察用户行为自动调整界面；10）A/B测试整合：持续测试不同界面变体的效果；11）情境自适应：根据使用环境（移动设备、桌面）优化体验。这种多适应性界面能显著提高不同学习风格用户的参与度和学习效果。"
      }
    ]
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

// 为对话生成记忆的函数
async function generateMemoriesFromConversation(userId: number, conversation: any): Promise<string[]> {
  console.log(`为用户${userId}生成对话"${conversation.title}"的记忆...`);
  
  const memoryIds: string[] = [];
  
  // 为每个用户消息创建记忆
  for (let i = 0; i < conversation.messages.length; i += 2) {
    const userMessage = conversation.messages[i];
    // 确保至少有一个对应的助手回复
    if (i + 1 < conversation.messages.length) {
      const assistantMessage = conversation.messages[i + 1];
      
      // 创建记忆 - 记录用户问题和AI回答
      const memoryContent = `用户问: ${userMessage.content}\n\nAI回答: ${assistantMessage.content}`;
      const summary = `关于"${conversation.title}"的对话，用户询问${userMessage.content.substring(0, 50)}...`;
      
      // 创建记忆
      const memory = await storage.createMemory(
        userId,
        memoryContent,
        "chat",
        summary
      );
      
      memoryIds.push(memory.id);
      console.log(`已创建记忆ID: ${memory.id}`);
      
      // 提取关键词并添加到记忆
      const keywords = extractKeywords(memoryContent);
      for (const keyword of keywords) {
        await storage.addKeywordToMemory(memory.id, keyword);
      }
      
      // 创建3072维的向量嵌入
      const vector = generateVectorForContent(memoryContent, i, Math.floor(i / 4));
      await storage.saveMemoryEmbedding(memory.id, vector);
      console.log(`已为记忆${memory.id}创建向量嵌入(维度=${vector.length})`);
      
      // 添加延迟以避免过快创建记忆
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return memoryIds;
}

// 提取关键词的函数
function extractKeywords(content: string): string[] {
  // 简单的关键词提取逻辑
  const words = content
    .replace(/[.,。，、；:!?？！]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && word.length <= 10);
  
  // 按词频排序并取前5-10个词
  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }
  
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

// 生成向量嵌入的函数
function generateVectorForContent(content: string, messageIndex: number, topicIndex: number): number[] {
  // 创建一个3072维的随机向量，但使其具有一定的特征
  const vector = Array(3072).fill(0).map(() => (Math.random() - 0.5) * 0.01);
  
  // 为同一主题的内容创建相似的向量特征，以便聚类时能够正确分组
  // 计算该对话应该属于的主题索引，每个主题设置不同的特征
  const segmentStart = topicIndex % 8 * 384; // 将3072维划分为8个段，每个主题强化不同段
  
  // 在特定段中设置较高的值，使得同一主题的向量相似
  for (let i = 0; i < 384; i++) {
    vector[segmentStart + i] = Math.random() * 0.5 + 0.5; // 0.5-1.0之间的值
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

    // 为每个对话主题生成记忆
    let totalMemories = 0;
    for (const conversation of CONVERSATION_DATA) {
      const memoryIds = await generateMemoriesFromConversation(TEST_USER_ID, conversation);
      totalMemories += memoryIds.length;
      console.log(`已为主题"${conversation.title}"创建${memoryIds.length}条记忆`);
    }

    console.log(`完成数据生成！总共创建了${totalMemories}条记忆`);

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
      memoriesCreated: totalMemories,
      clusterCount: clusterResult.clusterCount,
      knowledgeGraphNodes: knowledgeGraph.nodes.length,
      knowledgeGraphLinks: knowledgeGraph.links.length
    };

    // 保存结果
    const resultsDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    const resultFile = path.join(resultsDir, `data_generation_result_${Date.now()}.json`);
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