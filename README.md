# 启发式智能导学系统 | Heuristic Intelligent Learning System

<div align="center">
  <img src="./public/logo.svg" alt="启发式智能导学系统 Logo" width="180" height="180">
  <h1>启发式智能导学系统 | Heuristic Intelligent Learning System</h1>
  
  <p>
    <strong>个性化知识导航系统</strong>
  </p>
  
  <p>
    <a href="#"><img src="https://img.shields.io/badge/版本-1.0.0-brightgreen" alt="Version 1.0.0"></a>
    <a href="#"><img src="https://img.shields.io/badge/许可证-MIT-blue" alt="License: MIT"></a>
    <a href="#"><img src="https://img.shields.io/badge/Node.js-v20-success" alt="Node.js v20"></a>
    <a href="#"><img src="https://img.shields.io/badge/部署-Vercel_Ready-black" alt="Vercel Ready"></a>
    <a href="#"><img src="https://img.shields.io/badge/状态-稳定-success" alt="Status: Stable"></a>
  </p>
  
  <p>
    <a href="#核心能力">核心能力</a> •
    <a href="#系统架构">系统架构</a> •
    <a href="#快速开始">快速开始</a> •
    <a href="#技术特性">技术特性</a> •
    <a href="#部署">部署</a> •
    <a href="#参与贡献">参与贡献</a>
  </p>
  
  <br/>
  
  <img src="https://via.placeholder.com/800x450.png?text=启发式导师+系统界面预览" alt="启发式导师系统预览" width="80%">
</div>

## 📚 简介

**启发式智能导学系统**是一个融合多种先进大语言模型的智能教育平台，通过KWLQ学习模型、知识图谱可视化和先进的记忆管理系统，打造个性化、沉浸式的学习体验。系统能够理解学习者的需求，提供定制化的学习指导，并通过交互式知识探索促进深度学习。

### 为什么选择启发式智能导学系统？

- 🧠 **认知科学驱动** - 基于KWLQ学习框架设计，优化知识获取和记忆形成
- 🔍 **语义理解能力** - 使用3072维高精度向量嵌入，捕捉复杂概念间的细微关系
- 🌐 **多模型协同** - 无缝整合Grok、DeepSeek、Gemini等顶尖AI模型，智能路由最适合的模型处理不同类型的问题
- 🔄 **持久化交互** - 即使在网络不稳定情况下，也能确保学习进度不丢失
- 📊 **数据驱动洞察** - 通过聚类分析和知识图谱生成，揭示学习模式和知识关联

## 🔥 核心能力

<div align="center">
  <table>
    <tr>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=AI" width="80px"><br/>
        <strong>多模型协作</strong><br/>
        <small>智能模型选择与负载均衡</small>
      </td>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=RAG" width="80px"><br/>
        <strong>检索增强生成</strong><br/>
        <small>结合历史记忆与网络知识</small>
      </td>
      <td align="center" width="33%">
        <img src="https://via.placeholder.com/80x80.png?text=3D" width="80px"><br/>
        <strong>知识图谱</strong><br/>
        <small>交互式3D知识可视化</small>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=DB" width="80px"><br/>
        <strong>持久化记忆</strong><br/>
        <small>高维向量数据库</small>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=KWLQ" width="80px"><br/>
        <strong>KWLQ框架</strong><br/>
        <small>结构化学习方法论</small>
      </td>
      <td align="center">
        <img src="https://via.placeholder.com/80x80.png?text=ML" width="80px"><br/>
        <strong>自适应学习</strong><br/>
        <small>个性化学习路径生成</small>
      </td>
    </tr>
  </table>
</div>

## 🏗️ 系统架构

启发式导师采用模块化、可伸缩的现代系统架构：

```mermaid
graph TD
    A[用户界面] --> B[会话管理器]
    B --> C{路由选择器}
    C -->|Grok模型| D[Grok服务]
    C -->|DeepSeek模型| E[DeepSeek服务]
    C -->|Gemini模型| F[Gemini服务]
    C -->|Dify模型| G[Dify服务]
    D & E & F & G --> H[响应处理器]
    H --> I[持久化延迟响应管理器]
    I --> J[数据库存储]
    B --> K[记忆检索系统]
    K --> L[向量嵌入管理器]
    L --> M[聚类分析引擎]
    M --> N[知识图谱生成器]
    N --> O[学习路径构建器]
    O --> P[学习建议生成器]
    P --> B
```

### 核心组件

| 组件 | 描述 |
|------|------|
| **会话管理器** | 处理用户交互，维护对话状态，应用KWLQ学习框架 |
| **路由选择器** | 根据问题类型和上下文智能选择最佳AI模型 |
| **记忆检索系统** | 使用语义搜索从向量数据库中检索相关记忆 |
| **持久化延迟响应管理器** | 跟踪长时间运行的API请求，确保即使服务重启也能完成响应 |
| **聚类分析引擎** | 对记忆向量进行聚类分析，发现知识主题和关联 |
| **知识图谱生成器** | 构建交互式3D/2D知识图谱，展示概念间关系 |
| **学习路径构建器** | 基于用户记忆和学习目标生成个性化学习路径 |

## ⚡ 快速开始

### 系统要求

- **Node.js**: v20.x 或更高版本
- **PostgreSQL**: v16.x
- **Python**: v3.11（用于向量处理和聚类服务）
- **存储**: 至少1GB可用空间

### 安装指南

#### 使用Docker（推荐）

```bash
# 拉取镜像
docker pull heuristictutor/complete:latest

# 启动容器
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:password@db:5432/tutor \
  -e GEMINI_API_KEY=your_gemini_key \
  -e DEEPSEEK_API_KEY=your_deepseek_key \
  -e GROK_API_KEY=your_grok_key \
  heuristictutor/complete:latest
```

#### 手动安装

1. **克隆仓库**

```bash
git clone https://github.com/yourusername/heuristic-tutor.git
cd heuristic-tutor
```

2. **安装依赖**

```bash
# 安装Node.js依赖
npm install

# 安装Python依赖
pip install -r requirements.txt
```

3. **配置环境**

创建`.env`文件并添加所需配置：

```env
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/dbname

# AI模型API密钥
GEMINI_API_KEY=your_gemini_key
DEEPSEEK_API_KEY=your_deepseek_key 
GROK_API_KEY=your_grok_key
DIFY_API_KEY=your_dify_key

# 应用配置
NODE_ENV=development
PORT=5000
SESSION_SECRET=your_session_secret
CONTENT_VALUE_THRESHOLD=0.2
MAX_DELAYED_RESPONSE_ATTEMPTS=5
DELAYED_RESPONSE_CHECK_INTERVAL=60000
```

4. **设置数据库**

```bash
# 创建数据库结构
npm run db:migrate
```

5. **启动应用**

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

现在可以访问 `http://localhost:5000` 开始使用启发式导师！

## 🧩 技术特性

### 1. 多模型智能协作系统

本系统集成了多种先进大语言模型，使用智能路由机制根据问题类型和上下文选择最合适的模型：

```typescript
// 模型选择示例
const modelSelector = new ModelSelector({
  defaultModel: 'gemini',
  modelPreferences: {
    creative: 'grok',
    factual: 'deepseek',
    educational: 'gemini',
    complex: 'dify'
  }
});

const response = await modelSelector.route(query, context);
```

### 2. 动态提示注入技术

系统使用模板化的提示注入系统，根据用户上下文和检索内容动态构建优化的提示：

```typescript
// 提示模板示例
const promptTemplate = `
{{#system}}
你是一位启发式导师，使用KWLQ学习框架指导用户。
当前日期是{{current_date}}。
{{/system}}

{{#if memory}}
以下是与用户问题相关的历史记忆：
{{memory}}
{{/if}}

{{#if web_search}}
以下是从网络搜索获得的相关信息：
{{web_search}}
{{/if}}

用户问题：{{query}}
`;
```

### 3. 持久化延迟响应管理

对于长时间运行的API请求，系统实现了数据库持久化的跟踪机制，确保即使在服务重启后也能正确处理响应：

```typescript
// 数据库结构片段
interface MessageWithPending {
  id: string;
  content: string;
  isPending: boolean;
  pendingEndpoint: string | null;
  pendingPayload: any | null;
  pendingHeaders: Record<string, string> | null;
  pendingAttempt: number | null;
  pendingMaxAttempts: number | null;
  lastCheckTime: Date | null;
}
```

### 4. 高维向量表示与聚类

使用3072维向量表示记忆内容，通过科学的聚类算法发现主题关联：

```python
# Python聚类分析示例
def perform_clustering(vectors, n_clusters=None):
    """对向量执行自适应聚类分析"""
    if n_clusters is None:
        # 自动确定最佳聚类数
        n_clusters = determine_optimal_clusters(vectors)
    
    # 使用K-means执行聚类
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    cluster_labels = kmeans.fit_predict(vectors)
    
    # 计算聚类中心
    centroids = kmeans.cluster_centers_
    
    return {
        'labels': cluster_labels,
        'centroids': centroids,
        'n_clusters': n_clusters
    }
```

## 🚀 部署

### Vercel部署

启发式导师完全兼容Vercel平台，提供了专用的部署配置：

1. 在Vercel上创建新项目并链接GitHub仓库
2. 配置以下环境变量:
   - `DATABASE_URL`: 你的PostgreSQL连接字符串
   - `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `GROK_API_KEY`: 模型API密钥
3. 使用以下构建配置:
   - 构建命令: `npm run build`
   - 输出目录: `dist`
   - 安装命令: `npm ci`

### Docker部署

提供了Docker部署支持，适合各种云平台:

```bash
# 构建Docker镜像
docker build -t heuristic-tutor:latest .

# 运行容器
docker run -d -p 5000:5000 \
  -e DATABASE_URL=... \
  -e GEMINI_API_KEY=... \
  heuristic-tutor:latest
```

### 扩展性考虑

- 对于高流量应用，推荐使用Kubernetes进行容器编排
- 可以配置水平扩展，根据需求动态调整实例数量
- 对于多区域部署，建议使用一致性哈希进行用户会话路由

## 📈 性能优化

启发式导师经过精心优化，可处理大量并发用户：

| 指标 | 性能 |
|------|------|
| 响应时间 | 平均 < 500ms |
| 并发用户 | 单实例支持100+ |
| 内存占用 | ~500MB基准，峰值<1GB |
| 数据库连接 | 连接池优化，最大20连接 |

### 缓存策略

系统实现了多级缓存机制：

1. **内存缓存**: 频繁访问的数据（用户会话、活跃对话）
2. **数据库缓存**: 知识图谱渲染结果、聚类分析
3. **文件系统缓存**: 静态资源、模型配置

## 🔒 安全与隐私

- **数据加密**: 所有API通信使用TLS加密
- **认证**: 支持多种认证方式（JWT、OAuth2、Session）
- **隐私保护**: 用户记忆数据隔离，提供数据导出/删除功能
- **合规**: 符合GDPR、CCPA等数据保护法规

## 🔮 未来计划

正在积极开发的功能：

- [ ] 多模态输入支持 (图像、音频、文档)
- [ ] 自定义模型微调和个性化
- [ ] 移动应用集成
- [ ] AR/VR知识图谱体验
- [ ] 教育机构专用版本

## 📜 许可证

本项目采用MIT许可证 - 详情请参见[LICENSE](./LICENSE)文件

## 🙏 致谢
- 特别感谢AI模型提供商的API支持
- 感谢开源社区提供的各种优秀工具和库

<div align="center">
  <strong>启发式智能导学系统 - 重新定义智能学习体验</strong><br/>
  <sub>© 2025 启发式智能导学系统</sub>
</div>
