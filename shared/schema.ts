import { pgTable, text, serial, timestamp, boolean, integer, primaryKey, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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
  isEdited: boolean("is_edited").default(false),
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
  id: serial("id").primaryKey(),
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
  memoryId: integer("memory_id").notNull().references(() => memories.id),
  keyword: text("keyword").notNull(),
});

// 记忆关键词与记忆的关系
export const memoryKeywordsRelations = relations(memoryKeywords, ({ one }) => ({
  memory: one(memories, {
    fields: [memoryKeywords.memoryId],
    references: [memories.id],
  }),
}));

// 记忆嵌入向量表：存储记忆的向量表示
export const memoryEmbeddings = pgTable("memory_embeddings", {
  id: serial("id").primaryKey(),
  memoryId: integer("memory_id").notNull().references(() => memories.id).unique(),
  vectorData: json("vector_data").notNull(), // 存储为JSON数组
});

// 记忆嵌入向量与记忆的关系
export const memoryEmbeddingsRelations = relations(memoryEmbeddings, ({ one }) => ({
  memory: one(memories, {
    fields: [memoryEmbeddings.memoryId],
    references: [memories.id],
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

export const insertMemorySchema = createInsertSchema(memories);
export const insertMemoryKeywordSchema = createInsertSchema(memoryKeywords);
export const insertMemoryEmbeddingSchema = createInsertSchema(memoryEmbeddings);
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const insertSearchResultSchema = createInsertSchema(searchResults);
export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export const insertConversationAnalyticsSchema = createInsertSchema(conversationAnalytics);
export const insertUserFileSchema = createInsertSchema(userFiles);
export const insertUserSettingSchema = createInsertSchema(userSettings);

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