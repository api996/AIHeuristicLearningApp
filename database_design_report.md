# 数据库设计报告

## 概述

本报告详细描述了AI学习伴侣系统的数据库设计。该系统使用PostgreSQL数据库存储和管理用户数据、学习记忆、聊天历史和学习轨迹等信息。数据库设计遵循关系型数据库的最佳实践，同时利用了PostgreSQL的JSONB类型来存储半结构化数据。

## 数据库表结构

系统共包含20个表，可以分为以下几个主要功能模块：

1. **用户管理** - 存储用户账户和设置信息
2. **记忆系统** - 管理用户的学习记忆和语义向量
3. **对话系统** - 处理用户与AI的对话历史
4. **学习轨迹** - 跟踪用户的学习进度和知识图谱
5. **系统管理** - 提供系统级配置和功能
6. **智能学生代理** - 模拟学习者行为进行教学互动

### 核心表详解

#### 1. 用户管理

##### users
该表存储用户账户信息。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键，用户唯一标识 |
| username | text | 用户名 |
| password | text | 加密后的密码 |
| role | text | 用户角色 (普通用户/管理员) |

##### user_settings
存储用户个性化设置。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| background_file | text | 背景图片文件名 |
| theme | text | 用户界面主题 |
| font_size | text | 字体大小设置 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

#### 2. 记忆系统

##### memories
存储用户的学习记忆内容。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | text | 主键，记忆唯一标识 |
| user_id | integer | 外键，关联users表 |
| content | text | 记忆内容 |
| type | text | 记忆类型 |
| timestamp | timestamp | 记忆创建时间戳 |
| summary | text | 记忆摘要 |
| created_at | timestamp | 记录创建时间 |
| updated_at | timestamp | 记录更新时间 |

##### memory_embeddings
存储记忆的向量嵌入表示。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| memory_id | text | 外键，关联memories表 |
| vector_data | jsonb | 向量数据 |

##### memory_keywords
存储记忆的关键词。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| memory_id | text | 外键，关联memories表 |
| keyword | text | 关键词 |

#### 3. 对话系统

##### chats
存储用户的聊天会话。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键，聊天唯一标识 |
| user_id | integer | 外键，关联users表 |
| title | text | 聊天标题 |
| model | text | 使用的AI模型 |
| created_at | timestamp | 创建时间 |
| metadata | jsonb | 元数据信息 |

##### messages
存储聊天中的消息内容。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| chat_id | integer | 外键，关联chats表 |
| content | text | 消息内容 |
| role | text | 发送者角色 (用户/AI) |
| model | text | 生成消息的模型 |
| feedback | text | 用户反馈 |
| feedback_text | text | 反馈文本 |
| is_edited | boolean | 是否已编辑 |
| is_active | boolean | 是否处于活动状态 |
| created_at | timestamp | 创建时间 |

##### conversation_analytics
存储对话分析结果。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| chat_id | integer | 外键，关联chats表 |
| current_phase | text | 当前对话阶段 |
| summary | text | 对话摘要 |
| timestamp | timestamp | 分析时间 |

#### 4. 学习轨迹

##### learning_paths
存储用户的学习轨迹信息。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| topics | jsonb | 学习主题数据 |
| distribution | jsonb | 主题分布数据 |
| suggestions | jsonb | 学习建议 |
| progress_history | jsonb | 进度历史 |
| knowledge_graph | jsonb | 知识图谱数据 |
| version | integer | 版本号 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |
| is_optimized | boolean | 是否已优化 |
| expires_at | timestamp | 过期时间 |

##### cluster_result_cache
缓存记忆聚类分析结果。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| cluster_data | jsonb | 聚类数据 |
| cluster_count | integer | 聚类数量 |
| vector_count | integer | 向量数量 |
| version | integer | 版本号 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |
| expires_at | timestamp | 过期时间 |

##### knowledge_graph_cache
缓存知识图谱数据。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| nodes | jsonb | 图谱节点数据 |
| links | jsonb | 图谱连接数据 |
| version | integer | 版本号 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |
| expires_at | timestamp | 过期时间 |

#### 5. 系统管理

##### system_config
存储系统配置信息。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| key | text | 配置键 |
| value | text | 配置值 |
| description | text | 配置描述 |
| updated_at | timestamp | 更新时间 |
| updated_by | integer | 外键，关联users表 |

##### search_results
缓存搜索结果。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| query | text | 搜索查询 |
| results | jsonb | 搜索结果 |
| created_at | timestamp | 创建时间 |
| expires_at | timestamp | 过期时间 |

##### user_files
管理用户上传的文件。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| file_id | text | 文件唯一标识 |
| original_name | text | 原始文件名 |
| file_path | text | 文件路径 |
| file_type | text | 文件类型 |
| public_url | text | 公共访问URL |
| storage_type | text | 存储类型 |
| created_at | timestamp | 创建时间 |

#### 6. 智能学生代理

##### student_agent_presets
存储学生代理预设配置。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| ... | ... | ... |

##### student_agent_sessions
存储学生代理会话信息。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| user_id | integer | 外键，关联users表 |
| preset_id | integer | 外键，关联student_agent_presets表 |
| name | varchar(255) | 会话名称 |
| learning_topic | varchar(255) | 学习主题 |
| current_state | jsonb | 当前状态 |
| motivation_level | integer | 学习动机水平 |
| confusion_level | integer | 困惑程度 |
| completed_objectives | jsonb | 已完成目标 |
| created_at | timestamp | 创建时间 |
| last_interaction_at | timestamp | 最后交互时间 |
| is_active | boolean | 是否活跃 |

##### student_agent_messages
存储代理会话中的消息。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| session_id | integer | 外键，关联student_agent_sessions表 |
| ... | ... | ... |

##### student_agent_evaluations
存储代理会话评估结果。

| 列名 | 数据类型 | 说明 |
|------|---------|------|
| id | integer | 主键 |
| session_id | integer | 外键，关联student_agent_sessions表 |
| evaluator_id | integer | 外键，关联users表 |
| ... | ... | ... |

## 表关系

数据库中存在以下主要关系：

1. **用户与记忆**: users(1) --> memories(N)
2. **用户与设置**: users(1) --> user_settings(1)
3. **用户与学习轨迹**: users(1) --> learning_paths(N)
4. **用户与聊天**: users(1) --> chats(N)
5. **聊天与消息**: chats(1) --> messages(N)
6. **记忆与向量嵌入**: memories(1) --> memory_embeddings(N)
7. **记忆与关键词**: memories(1) --> memory_keywords(N)
8. **用户与聚类缓存**: users(1) --> cluster_result_cache(N)
9. **用户与文件**: users(1) --> user_files(N)
10. **聊天与对话分析**: chats(1) --> conversation_analytics(N)
11. **用户与学生代理会话**: users(1) --> student_agent_sessions(N)
12. **预设与学生代理会话**: student_agent_presets(1) --> student_agent_sessions(N)
13. **学生代理会话与消息**: student_agent_sessions(1) --> student_agent_messages(N)
14. **学生代理会话与评估**: student_agent_sessions(1) --> student_agent_evaluations(N)

## 数据类型与存储选择

系统利用PostgreSQL的JSONB类型存储半结构化数据，包括：

1. **向量数据** - 使用JSONB存储高维向量，便于语义搜索
2. **聚类结果** - 使用JSONB存储复杂的聚类分析结果
3. **知识图谱** - 使用JSONB存储节点和连接信息
4. **主题分布** - 使用JSONB存储用户的主题兴趣分布

## 缓存策略

系统实现了多层缓存策略，避免重复计算耗时操作：

1. **聚类缓存** - 缓存记忆聚类分析结果
2. **知识图谱缓存** - 缓存生成的知识图谱
3. **搜索结果缓存** - 缓存外部搜索查询结果

每个缓存表都包含expires_at字段，用于实现自动过期机制。

## 数据存储优化

为提高性能和降低数据库负载，系统采用以下优化策略：

1. **缓存表设计** - 减少重复计算和API调用
2. **JSONB索引** - 为JSONB类型的字段创建GIN索引，加速基于JSON内容的查询
3. **过期策略** - 为缓存数据设置过期时间，自动清理过期数据
4. **版本控制** - 为关键数据实现版本控制，便于追踪变更

## 结论

本数据库设计针对AI学习伴侣系统的特殊需求进行了优化，特别关注记忆管理、语义搜索和个性化学习轨迹功能。设计既兼顾了关系型数据库的规范性，又充分利用了PostgreSQL的JSONB类型来处理复杂的半结构化数据。通过合理的缓存策略，系统能够高效地存储和检索大量用户学习数据，同时保持良好的性能和可扩展性。