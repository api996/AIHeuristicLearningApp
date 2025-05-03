# 智能学习伴侣系统数据库设计报告

## 1. 概述

本文档详细描述智能学习伴侣系统的数据库设计，重点关注学习轨迹、记忆聚类和主题提取功能的实现。系统使用PostgreSQL作为数据库管理系统，通过Drizzle ORM进行数据库交互。

## 2. 数据库架构

系统数据库包含20个表，按功能分为以下几类：

### 2.1 用户相关表

- **users**: 存储用户信息
- **user_settings**: 存储用户设置
- **user_files**: 存储用户文件信息

### 2.2 聊天相关表

- **chats**: 存储聊天会话
- **messages**: 存储聊天消息
- **conversation_analytics**: 存储对话分析结果

### 2.3 记忆相关表

- **memories**: 存储用户记忆内容
- **memory_embeddings**: 存储记忆的向量表示
- **memory_keywords**: 存储记忆关键词

### 2.4 学习相关表

- **learning_paths**: 存储用户学习轨迹
- **cluster_result_cache**: 缓存聚类结果
- **knowledge_graph_cache**: 缓存知识图谱

### 2.5 智能体相关表

- **student_agent_presets**: 存储学生智能体配置
- **student_agent_sessions**: 存储智能体会话
- **student_agent_messages**: 存储智能体消息
- **student_agent_evaluations**: 存储智能体评估结果

### 2.6 系统表

- **prompt_templates**: 存储提示词模板
- **system_config**: 存储系统配置
- **search_results**: 存储搜索结果
- **session**: 存储用户会话信息

## 3. 关键表结构详解

### 3.1 学习轨迹表 (learning_paths)

该表存储用户的学习轨迹数据，包括主题分布、学习建议和知识图谱。

```sql
CREATE TABLE learning_paths (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  topics JSONB NOT NULL,
  distribution JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  progress_history JSONB,
  knowledge_graph JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_optimized BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP
);
```

字段说明：
- **topics**: 用户学习主题的JSON数组，每个主题包含id、topic（主题名称）、count（记忆数量）和percentage（百分比）
- **distribution**: 主题分布数据，用于前端可视化展示
- **suggestions**: 基于学习主题生成的学习建议
- **progress_history**: 学习进度历史记录
- **knowledge_graph**: 知识图谱数据，包含nodes和links
- **expires_at**: 数据过期时间，用于触发重新计算
- **is_optimized**: 标记数据是否经过优化处理

### 3.2 聚类结果缓存表 (cluster_result_cache)

该表缓存用户记忆的聚类分析结果，避免频繁重新计算。

```sql
CREATE TABLE cluster_result_cache (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  cluster_data JSONB NOT NULL,
  cluster_count INTEGER NOT NULL,
  vector_count INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

字段说明：
- **cluster_data**: 包含聚类结果的JSON数据，主要是记忆ID到聚类的映射
- **cluster_count**: 聚类的数量
- **vector_count**: 参与聚类的向量数量
- **expires_at**: 缓存过期时间

### 3.3 记忆表 (memories)

存储用户的记忆数据，是系统的核心数据表之一。

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  type TEXT DEFAULT 'chat',
  timestamp TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

字段说明：
- **id**: 使用时间戳格式的唯一标识符
- **content**: 记忆的具体内容
- **summary**: 记忆内容的摘要
- **type**: 记忆类型，如'chat'、'note'等

### 3.4 记忆向量表 (memory_embeddings)

存储记忆的向量表示，用于语义检索和聚类分析。

```sql
CREATE TABLE memory_embeddings (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL,
  vector REAL[] NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

字段说明：
- **memory_id**: 关联到memories表的ID
- **vector**: 3072维的向量数组，表示记忆在语义空间中的位置

## 4. 关键数据流程

### 4.1 学习轨迹生成与保存流程

1. 用户记忆数据被转换为向量表示 (memory_embeddings)
2. 系统对向量进行聚类分析
3. 聚类结果被缓存到 cluster_result_cache 表
4. 基于聚类结果生成主题和学习建议
5. 学习轨迹数据被保存到 learning_paths 表

该流程的关键组件包括：

- **trajectory.ts**: 负责从聚类结果生成学习轨迹
- **directSave.ts**: 提供直接数据库保存功能，确保数据一致性
- **cluster_cache_service.ts**: 管理聚类结果缓存

### 4.2 记忆处理流程

1. 用户创建记忆（聊天、笔记等）
2. 记忆内容被存储到 memories 表
3. 记忆文本转换为向量表示，存储到 memory_embeddings 表
4. 提取关键词，存储到 memory_keywords 表
5. 当记忆数量达到阈值时，触发聚类分析

### 4.3 数据更新与缓存刷新机制

系统采用基于过期时间的缓存机制：

1. 学习轨迹和聚类缓存数据都设置了 expires_at 字段
2. 当用户请求数据时，系统先检查缓存数据是否有效
3. 如果缓存过期或用户请求强制刷新，则重新计算
4. 使用 directSave.ts 提供的清除旧数据功能，确保数据一致性

## 5. 数据存储考量

### 5.1 JSONB 数据类型的使用

系统广泛使用 PostgreSQL 的 JSONB 类型存储结构化数据，包括：

- 学习轨迹中的主题数据 (topics)
- 聚类结果数据 (cluster_data)
- 知识图谱数据 (knowledge_graph)

这种方式提供了灵活性，同时维持了良好的查询性能。

### 5.2 向量数据存储

记忆向量使用 REAL[] 数组类型存储，每个向量维度为3072，支持：

- 基于余弦相似度的语义搜索
- K-means聚类分析
- 主题提取和关联分析

### 5.3 中文数据支持

系统完全支持中文数据的存储和处理：

- 使用UTF-8编码确保中文字符正确存储
- 向量化处理支持中文语义理解
- 聚类标签正确显示中文主题名称

## 6. 数据库优化和问题解决

### 6.1 "未知主题"显示问题修复

之前系统存在主题显示为"未知主题"的问题，主要原因是学习轨迹数据未被正确保存到数据库，导致每次需要重新计算。解决方案：

1. 增强了 directSaveLearningPath 函数，改进错误处理和日志记录
2. 修改 trajectory.ts 实现更健壮的保存逻辑，在保存前清除旧数据
3. 验证数据库查询，确保中文格式正确保存和显示

### 6.2 性能优化

为了提高系统性能，实施了以下优化：

1. 实现双层缓存机制：内存缓存+数据库缓存
2. 聚类结果缓存避免重复计算
3. 设置适当的缓存过期时间平衡新鲜度和性能
4. 优化记忆向量检索算法

## 7. 总结与建议

智能学习伴侣系统的数据库设计有效支持了学习轨迹生成、记忆聚类和主题提取功能。主要特点：

1. 采用PostgreSQL提供的高级数据类型和查询功能
2. 实现多层缓存机制减少计算负担
3. 支持中文数据处理和显示
4. 提供直接数据库操作功能保证数据一致性

未来优化方向：

1. 考虑引入专门的向量数据库扩展，如pgvector
2. 优化大量记忆数据情况下的聚类性能
3. 实现增量式聚类算法，避免全量重新计算
4. 添加更多索引提升查询性能