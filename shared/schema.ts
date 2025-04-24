import { pgTable, text, serial, timestamp, boolean, integer, primaryKey, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// 定义会话表结构，确保connect-pg-simple能正确使用
// 注意：此表在本模块中声明，但由connect-pg-simple模块管理
// 它只需要作为表结构定义出现，不需要创建对应的插入schema
export const session = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { mode: "date" }).notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
});

// 用户文件表 - 用于存储用户上传的文件（背景图片、头像等）
export const userFiles = pgTable("user_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fileId: text("file_id").notNull().unique(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type", { enum: ["background", "avatar", "attachment"] }).notNull().default("attachment"),
  publicUrl: text("public_url").notNull(),
  // 存储类型，用于区分文件存储位置：file-system(文件系统) 或 object-storage(对象存储)
  storageType: text("storage_type", { enum: ["file-system", "object-storage"] }).notNull().default("file-system"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 用户设置表 - 存储用户偏好设置
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  backgroundFile: text("background_file"), // 引用userFiles中的fileId
  theme: text("theme", { enum: ["light", "dark"] }).default("light"),
  fontSize: text("font_size", { enum: ["small", "medium", "large"] }).default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  chats: many(chats),
  files: many(userFiles),
  settings: one(userSettings),
}));

export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  title: text("title").notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: serial("chat_id").references(() => chats.id),
  content: text("content").notNull(),
  role: text("role").notNull(),
  model: text("model"),  // 添加模型字段，记录消息来自哪个AI模型
  feedback: text("feedback", { enum: ["like", "dislike"] }),
  feedbackText: text("feedback_text"),  // 添加文本反馈字段，可以存储用户的详细反馈
  isEdited: boolean("is_edited").default(false),
  isActive: boolean("is_active").default(true), // 标记消息是否为活动状态，用于支持重新生成中间消息后的分支管理
  createdAt: timestamp("created_at").defaultNow(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

// 记忆表：存储用户的学习记忆
export const memories = pgTable("memories", {
  // 使用文本类型作为ID，兼容时间戳格式ID
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  type: text("type").notNull().default("chat"),
  timestamp: timestamp("timestamp").defaultNow(),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 记忆与用户的关系
export const memoriesRelations = relations(memories, ({ one, many }) => ({
  user: one(users, {
    fields: [memories.userId],
    references: [users.id],
  }),
  keywords: many(memoryKeywords),
  embeddings: one(memoryEmbeddings),
}));

// 记忆关键词表：存储记忆的关键词
export const memoryKeywords = pgTable("memory_keywords", {
  id: serial("id").primaryKey(),
  // 使用text类型存储记忆ID，以支持时间戳格式ID
  memoryId: text("memory_id").notNull(),
  keyword: text("keyword").notNull(),
});

// 记忆关键词与记忆的关系 - 自定义关系逻辑
export const memoryKeywordsRelations = relations(memoryKeywords, ({ one }) => ({
  memory: one(memories, {
    // 使用自定义转换函数处理ID格式差异
    fields: [memoryKeywords.memoryId],
    references: [memories.id],
    relationName: 'memory_keywords_relation'
  }),
}));

// 记忆嵌入向量表：存储记忆的向量表示
export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: serial("id").primaryKey(),
  // 使用text类型存储记忆ID，以支持时间戳格式ID
  memoryId: text("memory_id").notNull(),
  vectorData: json("vector_data").notNull(), // 存储为JSON数组
});

// 记忆嵌入向量与记忆的关系 - 自定义关系逻辑
export const memoryEmbeddingsRelations = relations(memoryEmbeddings, ({ one }) => ({
  memory: one(memories, {
    // 使用自定义转换函数处理ID格式差异
    fields: [memoryEmbeddings.memoryId],
    references: [memories.id],
    relationName: 'memory_embeddings_relation'
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const insertChatSchema = createInsertSchema(chats);
export const insertMessageSchema = createInsertSchema(messages);
// 模型提示词模板表：存储各模型的提示词模板
export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull().unique(), // 模型ID，例如 'gemini', 'deepseek', 'grok' 等
  promptTemplate: text("prompt_template").notNull(), // 完整提示词模板（向后兼容）
  baseTemplate: text("base_template"), // 基础提示词
  kTemplate: text("k_template"), // K阶段提示词
  wTemplate: text("w_template"), // W阶段提示词
  lTemplate: text("l_template"), // L阶段提示词
  qTemplate: text("q_template"), // Q阶段提示词
  styleTemplate: text("style_template"), // 风格提示词
  policyTemplate: text("policy_template"), // 政策提示词
  sensitiveWords: text("sensitive_words"), // 敏感词列表，以逗号分隔
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// 搜索结果缓存表：存储搜索结果
export const searchResults = pgTable("search_results", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(), // 搜索查询
  results: json("results").notNull(), // 搜索结果 JSON
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // 缓存过期时间
});

// 系统配置表 - 存储全局系统设置
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // 配置键名
  value: text("value").notNull(), // 配置值
  description: text("description"), // 配置说明
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id), // 最后更新者
});

// 对话阶段分析表：存储对话阶段分析结果
export const conversationAnalytics = pgTable("conversation_analytics", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  currentPhase: text("current_phase", { enum: ["K", "W", "L", "Q"] }).notNull(), // 当前对话阶段
  summary: text("summary").notNull(), // 对话摘要
  timestamp: timestamp("timestamp").defaultNow(),
});

// 知识图谱缓存表：存储预计算的知识图谱数据
export const knowledgeGraphCache = pgTable("knowledge_graph_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  nodes: json("nodes").notNull(), // 图谱节点数据
  links: json("links").notNull(), // 图谱连接数据
  version: integer("version").notNull().default(1), // 版本号用于刷新缓存
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // 缓存过期时间
});

// 聚类结果缓存表：存储记忆聚类分析结果
export const clusterResultCache = pgTable("cluster_result_cache", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  clusterData: json("cluster_data").notNull(), // 聚类结果数据
  clusterCount: integer("cluster_count").notNull(), // 聚类数量
  vectorCount: integer("vector_count").notNull(), // 向量数量
  version: integer("version").notNull().default(1), // 版本号
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // 缓存过期时间
});

// 学习轨迹表：存储用户的学习轨迹和分布数据
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  // 主题数据，包含主题名称和百分比
  topics: json("topics").notNull(), // 格式：[{topic: "主题1", id: "topic_1", percentage: 80}, ...]
  // 学习分布数据
  distribution: json("distribution").notNull(), // 格式：[{topic: "主题1", percentage: 80}, ...]
  // 学习建议
  suggestions: json("suggestions").notNull(), // 格式：["建议1", "建议2", ...]
  // 学习进度历史记录，用于跟踪进步
  progressHistory: json("progress_history"), // 格式：[{date: "2023-01-01", topics: [{topic: "主题1", percentage: 75}, ...]}]
  // 用于知识图谱展示的节点和连接数据
  knowledgeGraph: json("knowledge_graph"), // 格式：{nodes: [...], links: [...]}
  // 版本号，用于缓存控制
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // 标记学习轨迹数据是否已优化/精确化
  isOptimized: boolean("is_optimized").default(false),
});

export const insertMemorySchema = createInsertSchema(memories);
export const insertMemoryKeywordSchema = createInsertSchema(memoryKeywords);
export const insertMemoryEmbeddingSchema = createInsertSchema(memoryEmbeddings);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const insertSearchResultSchema = createInsertSchema(searchResults);
export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export const insertConversationAnalyticsSchema = createInsertSchema(conversationAnalytics);
export const insertUserFileSchema = createInsertSchema(userFiles);
export const insertUserSettingSchema = createInsertSchema(userSettings);
export const insertLearningPathSchema = createInsertSchema(learningPaths);

export type User = typeof users.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect & {
  isRegenerating?: boolean; // 用于UI中显示消息重新生成状态
};
export type Memory = typeof memories.$inferSelect;
export type MemoryKeyword = typeof memoryKeywords.$inferSelect;
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type SearchResult = typeof searchResults.$inferSelect;
export type ConversationAnalytic = typeof conversationAnalytics.$inferSelect;
export type UserFile = typeof userFiles.$inferSelect;
export type UserSetting = typeof userSettings.$inferSelect;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type KnowledgeGraphCache = typeof knowledgeGraphCache.$inferSelect;
export type ClusterResultCache = typeof clusterResultCache.$inferSelect;
export type LearningPath = typeof learningPaths.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type InsertMemoryKeyword = z.infer<typeof insertMemoryKeywordSchema>;
export type InsertMemoryEmbedding = z.infer<typeof insertMemoryEmbeddingSchema>;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type InsertSearchResult = z.infer<typeof insertSearchResultSchema>;
export type InsertConversationAnalytic = z.infer<typeof insertConversationAnalyticsSchema>;
export type InsertUserFile = z.infer<typeof insertUserFileSchema>;
export type InsertUserSetting = z.infer<typeof insertUserSettingSchema>;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;