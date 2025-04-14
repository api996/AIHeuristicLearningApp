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

export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats),
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
export const insertMemorySchema = createInsertSchema(memories);
export const insertMemoryKeywordSchema = createInsertSchema(memoryKeywords);
export const insertMemoryEmbeddingSchema = createInsertSchema(memoryEmbeddings);

export type User = typeof users.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect & {
  isRegenerating?: boolean; // 用于UI中显示消息重新生成状态
};
export type Memory = typeof memories.$inferSelect;
export type MemoryKeyword = typeof memoryKeywords.$inferSelect;
export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type InsertMemoryKeyword = z.infer<typeof insertMemoryKeywordSchema>;
export type InsertMemoryEmbedding = z.infer<typeof insertMemoryEmbeddingSchema>;