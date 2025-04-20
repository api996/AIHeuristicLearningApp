import { 
  users, type User, type InsertUser, 
  chats, messages, type Chat, type Message,
  memories, memoryKeywords, memoryEmbeddings,
  promptTemplates, searchResults, conversationAnalytics,
  userFiles, userSettings, systemConfig,
  type Memory, type MemoryKeyword, type MemoryEmbedding,
  type InsertMemory, type InsertMemoryKeyword, type InsertMemoryEmbedding,
  type PromptTemplate, type SearchResult, type ConversationAnalytic,
  type SystemConfig
} from "@shared/schema";
import { db } from "./db";
import { eq, ne, and, asc, desc, sql, inArray } from "drizzle-orm";
import { log } from "./vite";
import fs from 'fs';
import path from 'path';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
  updateUserRole(userId: number, role: "admin" | "user"): Promise<void>;
  deleteUser(userId: number): Promise<void>;
  
  // System config methods
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  getAllSystemConfigs(): Promise<SystemConfig[]>;
  upsertSystemConfig(key: string, value: string, description?: string, updatedBy?: number): Promise<SystemConfig>;

  // Chat methods
  createChat(userId: number, title: string, model: string): Promise<Chat>;
  getUserChats(userId: number, isAdmin: boolean): Promise<(Chat & { username?: string })[]>;
  deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void>;
  getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined>;
  updateChatTitle(chatId: number, title: string): Promise<void>;
  updateChatModel(chatId: number, model: string): Promise<void>;

  // Message methods
  createMessage(chatId: number, content: string, role: string, model?: string): Promise<Message>;
  getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]>;
  updateMessage(messageId: number, content: string, isUserOwned: boolean): Promise<Message>;
  updateMessageFeedback(messageId: number, feedback: "like" | "dislike"): Promise<Message>;
  regenerateMessage(messageId: number): Promise<Message>;
  getMessageById(messageId: number): Promise<Message | undefined>; // Added method

  // Memory methods
  createMemory(userId: number, content: string, type?: string, summary?: string, timestamp?: Date): Promise<Memory>;
  getMemoriesByUserId(userId: number): Promise<Memory[]>;
  getMemoryById(memoryId: number): Promise<Memory | undefined>;
  updateMemory(memoryId: number, content?: string, summary?: string): Promise<Memory>;
  deleteMemory(memoryId: number): Promise<void>;
  
  // Memory keywords methods
  addKeywordToMemory(memoryId: number, keyword: string): Promise<MemoryKeyword>;
  getKeywordsByMemoryId(memoryId: number): Promise<MemoryKeyword[]>;
  deleteKeywordsByMemoryId(memoryId: number): Promise<void>;
  
  // Memory embeddings methods
  saveMemoryEmbedding(memoryId: number, vectorData: number[]): Promise<MemoryEmbedding>;
  getEmbeddingByMemoryId(memoryId: number): Promise<MemoryEmbedding | undefined>;
  findSimilarMemories(userId: number, vectorData: number[], limit?: number): Promise<Memory[]>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  
  // Prompt template methods
  getPromptTemplate(modelId: string): Promise<PromptTemplate | undefined>;
  createOrUpdatePromptTemplate(
    modelId: string, 
    template: string, 
    userId: number,
    baseTemplate?: string,
    kTemplate?: string,
    wTemplate?: string,
    lTemplate?: string,
    qTemplate?: string,
    styleTemplate?: string,
    policyTemplate?: string,
    sensitiveWords?: string
  ): Promise<PromptTemplate>;
  getAllPromptTemplates(): Promise<PromptTemplate[]>;
  deletePromptTemplate(modelId: string): Promise<void>;
  
  // Search results methods
  saveSearchResult(query: string, results: any, expiryMinutes?: number): Promise<SearchResult>;
  getSearchResult(query: string): Promise<SearchResult | undefined>;
  deleteExpiredSearchResults(): Promise<number>; // Returns number of deleted records
  
  // Conversation analytics methods
  saveConversationAnalytic(
    chatId: number, 
    currentPhase: "K" | "W" | "L" | "Q", 
    summary: string
  ): Promise<ConversationAnalytic>;
  getLatestConversationAnalytic(chatId: number): Promise<ConversationAnalytic | undefined>;
  getConversationAnalyticHistory(chatId: number): Promise<ConversationAnalytic[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      log(`Error getting user: ${error}`);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      log(`Error getting user by username: ${error}`);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // 验证用户输入
      if (!insertUser.username || typeof insertUser.username !== 'string' || insertUser.username.length > 50) {
        throw new Error("Invalid username format");
      }

      if (!insertUser.password || typeof insertUser.password !== 'string') {
        throw new Error("Invalid password format");
      }

      // 清理输入以防止恶意注入
      const sanitizedUser = {
        username: insertUser.username.trim(),
        password: insertUser.password,
        role: insertUser.role || "user"
      };

      // 使用Drizzle ORM的参数化查询防止SQL注入
      const [user] = await db.insert(users).values(sanitizedUser).returning();
      return user;
    } catch (error) {
      log(`Error creating user: ${error}`);
      throw error;
    }
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    try {
      await db.update(users)
        .set({ password: newPassword })
        .where(eq(users.id, userId));
    } catch (error) {
      log(`Error updating user password: ${error}`);
      throw error;
    }
  }

  async updateUserRole(userId: number, role: "admin" | "user"): Promise<void> {
    try {
      await db.update(users)
        .set({ role })
        .where(eq(users.id, userId));
    } catch (error) {
      log(`Error updating user role: ${error}`);
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      // 使用事务确保所有删除操作要么全部成功，要么全部失败
      await db.transaction(async (tx) => {
        // 1. 先找到所有相关的聊天记录
        const userChats = await tx.select().from(chats).where(eq(chats.userId, userId));
        log(`为用户 ${userId} 找到 ${userChats.length} 条聊天记录`);
        
        // 2. 删除所有聊天中的消息
        for (const chat of userChats) {
          log(`删除聊天 ${chat.id} 的所有消息`);
          await tx.delete(messages).where(eq(messages.chatId, chat.id));
        }
        
        // 3. 删除所有聊天记录
        if (userChats.length > 0) {
          log(`删除用户 ${userId} 的所有聊天记录`);
          await tx.delete(chats).where(eq(chats.userId, userId));
        }
        
        // 4. 找到所有相关的记忆
        const userMemories = await tx.select().from(memories).where(eq(memories.userId, userId));
        log(`为用户 ${userId} 找到 ${userMemories.length} 条记忆`);
        
        // 5. 删除所有记忆关键词
        for (const memory of userMemories) {
          // 将记忆ID转换为字符串
          const memoryIdStr = String(memory.id);
          
          log(`删除记忆 ${memoryIdStr} 的关键词`);
          await tx.delete(memoryKeywords).where(eq(memoryKeywords.memoryId, memoryIdStr));
          
          // 6. 删除所有记忆嵌入
          log(`删除记忆 ${memoryIdStr} 的嵌入向量`);
          await tx.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, memoryIdStr));
        }
        
        // 7. 删除所有记忆
        if (userMemories.length > 0) {
          log(`删除用户 ${userId} 的所有记忆`);
          await tx.delete(memories).where(eq(memories.userId, userId));
        }
        
        // 8. 删除用户文件记录
        log(`删除用户 ${userId} 的文件记录`);
        await tx.delete(userFiles).where(eq(userFiles.userId, userId));
        
        // 9. 删除用户设置
        log(`删除用户 ${userId} 的设置`);
        await tx.delete(userSettings).where(eq(userSettings.userId, userId));
        
        // 10. 最后删除用户本身
        log(`删除用户 ${userId}`);
        await tx.delete(users).where(eq(users.id, userId));
      });
      
      // 删除文件系统中的记忆目录
      try {
        const memoryPath = path.join(process.cwd(), 'memory_space', userId.toString());
        if (fs.existsSync(memoryPath)) {
          log(`删除用户 ${userId} 的记忆文件目录: ${memoryPath}`);
          fs.rmSync(memoryPath, { recursive: true, force: true });
          log(`用户 ${userId} 的记忆文件目录已成功删除`);
        }
      } catch (fileError) {
        // 仅记录错误，但不抛出异常，因为数据库中的数据已经被删除
        log(`删除用户 ${userId} 的记忆文件目录时出错: ${fileError}`);
      }
      
      log(`用户 ${userId} 及其所有关联数据已成功删除`);
    } catch (error) {
      log(`删除用户错误: ${error}`);
      throw error;
    }
  }

  // Chat methods
  async createChat(userId: number, title: string, model: string): Promise<Chat> {
    try {
      const [chat] = await db.insert(chats)
        .values({ userId, title, model })
        .returning();
      return chat;
    } catch (error) {
      log(`Error creating chat: ${error}`);
      throw error;
    }
  }

  async getUserChats(userId: number, isAdmin: boolean): Promise<(Chat & { username?: string })[]> {
    try {
      if (isAdmin) {
        // 管理员查看特定用户的聊天记录
        const results = await db.select({
            id: chats.id,
            userId: chats.userId,
            title: chats.title,
            model: chats.model,
            createdAt: chats.createdAt,
            username: users.username
          })
          .from(chats)
          .leftJoin(users, eq(chats.userId, users.id))
          .where(eq(chats.userId, userId)) // 只返回指定用户的聊天记录
          .orderBy(desc(chats.createdAt));

        // 处理username为null的情况，将其转换为undefined
        return results.map(chat => ({
          ...chat,
          username: chat.username || undefined
        }));
      } else {
        // 普通用户只能看到自己的聊天记录
        return await db.select()
          .from(chats)
          .where(eq(chats.userId, userId))
          .orderBy(desc(chats.createdAt));
      }
    } catch (error) {
      log(`Error getting user chats: ${error}`);
      throw error;
    }
  }

  async deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void> {
    try {
      log(`[Storage] 开始删除聊天: chatId=${chatId}, userId=${userId}, isAdmin=${isAdmin}`);
      
      // First verify if the user has access to this chat
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        log(`[Storage] 删除失败: 用户 ${userId} 无权访问聊天 ${chatId} 或聊天不存在`);
        throw new Error(`Access denied or chat not found: chatId=${chatId}, userId=${userId}`);
      }
      
      log(`[Storage] 删除消息前查询到有效聊天: ${JSON.stringify({
        id: chat.id,
        title: chat.title,
        userId: chat.userId,
        createdAt: chat.createdAt
      })}`);

      try {
        // First delete all messages in the chat
        const deleteMessagesResult = await db.delete(messages).where(eq(messages.chatId, chatId));
        log(`[Storage] 删除聊天的所有消息完成: ${JSON.stringify(deleteMessagesResult)}`);
      } catch (msgError) {
        log(`[Storage] 删除聊天消息时出错: ${msgError}`);
        throw msgError;
      }
      
      try {
        // Then delete the chat itself
        const deleteChatResult = await db.delete(chats).where(eq(chats.id, chatId));
        log(`[Storage] 删除聊天记录完成: ${JSON.stringify(deleteChatResult)}`);
      } catch (chatError) {
        log(`[Storage] 删除聊天记录时出错: ${chatError}`);
        throw chatError;
      }
      
      log(`[Storage] 成功删除聊天: chatId=${chatId}`);
    } catch (error) {
      log(`[Storage] 删除聊天时发生错误: ${error}`);
      throw error;
    }
  }

  async getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined> {
    try {
      if (!chatId || isNaN(chatId)) {
        log(`无效的聊天ID: ${chatId}`);
        return undefined;
      }

      if (isAdmin) {
        // 即使是管理员，仍然要验证聊天记录是否存在
        const [chat] = await db.select()
          .from(chats)
          .where(eq(chats.id, chatId));
        return chat;
      } else {
        // 普通用户只能访问自己的聊天记录
        const [chat] = await db.select()
          .from(chats)
          .where(and(
            eq(chats.id, chatId),
            eq(chats.userId, userId)
          ));
        return chat;
      }
    } catch (error) {
      log(`Error getting chat by id: ${error}`);
      throw error;
    }
  }

  async updateChatTitle(chatId: number, title: string): Promise<void> {
    try {
      if (!chatId || isNaN(chatId)) {
        log(`Invalid chat ID for title update: ${chatId}`);
        throw new Error("Invalid chat ID");
      }

      if (!title || typeof title !== 'string') {
        log(`Invalid title format: ${title}`);
        throw new Error("Invalid title format");
      }

      // 限制标题长度，防止数据库存储问题
      const trimmedTitle = title.trim().substring(0, 100);

      // 更新聊天标题
      await db.update(chats)
        .set({ title: trimmedTitle })
        .where(eq(chats.id, chatId));

      log(`Chat title updated for chat ${chatId}: "${trimmedTitle}"`);
    } catch (error) {
      log(`Error updating chat title: ${error}`);
      throw error;
    }
  }

  async updateChatModel(chatId: number, model: string): Promise<void> {
    try {
      if (!chatId || isNaN(chatId)) {
        log(`Invalid chat ID for model update: ${chatId}`);
        throw new Error("Invalid chat ID");
      }

      if (!model || typeof model !== 'string') {
        log(`Invalid model name: ${model}`);
        throw new Error("Invalid model name");
      }

      // 验证模型名称有效性（可以扩展为验证支持的模型列表）
      const validModels = ["search", "deep", "gemini", "deepseek", "grok"];
      if (!validModels.includes(model)) {
        log(`Unsupported model: ${model}`);
        throw new Error("Unsupported model");
      }

      // 更新聊天所使用的模型
      await db.update(chats)
        .set({ model })
        .where(eq(chats.id, chatId));

      log(`Chat model updated for chat ${chatId} to "${model}"`);
    } catch (error) {
      log(`Error updating chat model: ${error}`);
      throw error;
    }
  }

  async createMessage(chatId: number, content: string, role: string, model?: string): Promise<Message> {
    try {
      const [message] = await db.insert(messages)
        .values({ chatId, content, role, model })
        .returning();
      return message;
    } catch (error) {
      log(`Error creating message: ${error}`);
      throw error;
    }
  }

  // 获取单个消息
  async getMessageById(messageId: number): Promise<Message | undefined> {
    try {
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("Failed to get message by ID:", error);
      throw error;
    }
  }

  // TypeScript using an explicit return type
  async updateMessage(messageId: number, content: string, isUserOwned: boolean = false, model?: string): Promise<Message> {
    try {
      // 如果是用户更新消息，需要确保只能更新用户自己的消息
      const condition = isUserOwned ? eq(messages.role, "user") : undefined;

      // 准备更新字段
      const updateFields: any = { content, isEdited: true };
      
      // 如果提供了model参数，更新model字段
      if (model) {
        updateFields.model = model;
      }

      // 更新消息
      const results = await db
        .update(messages)
        .set(updateFields)
        .where(and(eq(messages.id, messageId), condition || undefined))
        .returning();

      if (results.length === 0) {
        throw new Error("Message not found or permission denied");
      }

      return results[0];
    } catch (error) {
      console.error("Failed to update message:", error);
      throw error;
    }
  }

  async updateMessageFeedback(messageId: number, feedback: "like" | "dislike"): Promise<Message> {
    try {
      if (!messageId || isNaN(messageId)) {
        log(`Invalid message ID for feedback: ${messageId}`);
        throw new Error("Invalid message ID");
      }

      // 确保反馈只能应用于AI消息
      const [message] = await db.select()
        .from(messages)
        .where(and(
          eq(messages.id, messageId),
          eq(messages.role, "assistant")
        ));

      if (!message) {
        throw new Error("Message not found or not an AI message");
      }

      // 更新消息反馈
      const [updatedMessage] = await db.update(messages)
        .set({ feedback })
        .where(eq(messages.id, messageId))
        .returning();

      log(`Feedback ${feedback} applied to message ${messageId}`);
      return updatedMessage;
    } catch (error) {
      log(`Error updating message feedback: ${error}`);
      throw error;
    }
  }

  async regenerateMessage(messageId: number): Promise<Message> {
    try {
      // 获取需要重新生成的消息
      const [message] = await db.select()
        .from(messages)
        .where(eq(messages.id, messageId));

      if (!message) {
        throw new Error("Message not found");
      }

      if (message.role !== "assistant") {
        throw new Error("Only AI messages can be regenerated");
      }

      // 这里只是返回现有消息
      // 实际重新生成在路由层处理，而非存储层
      return message;
    } catch (error) {
      log(`Error preparing message regeneration: ${error}`);
      throw error;
    }
  }

  async getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]> {
    try {
      // First verify if the user has access to this chat
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) return []; 

      // Only return messages if the user has access to the chat
      if (!isAdmin && chat.userId !== userId) return [];

      // Get messages for a specific chat
      return await db.select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(asc(messages.createdAt));
    } catch (error) {
      log(`Error getting chat messages: ${error}`);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      log(`Error getting all users: ${error}`);
      throw error;
    }
  }

  // Memory methods
  async createMemory(userId: number, content: string, type: string = "chat", summary?: string, timestamp?: Date): Promise<Memory> {
    try {
      if (!userId || isNaN(userId)) {
        throw new Error("Invalid user ID");
      }
      
      if (!content || typeof content !== 'string') {
        throw new Error("Invalid memory content");
      }
      
      // Insert memory record
      const [memory] = await db.insert(memories)
        .values({
          userId,
          content,
          type,
          summary,
          timestamp: timestamp || new Date()
        })
        .returning();
      
      log(`Memory created for user ${userId}, id: ${memory.id}`);
      return memory;
    } catch (error) {
      log(`Error creating memory: ${error}`);
      throw error;
    }
  }

  async getMemoriesByUserId(userId: number): Promise<Memory[]> {
    try {
      if (!userId || isNaN(userId)) {
        throw new Error("Invalid user ID");
      }
      
      // Get all memories for the user
      const userMemories = await db.select()
        .from(memories)
        .where(eq(memories.userId, userId))
        .orderBy(desc(memories.timestamp));
      
      return userMemories;
    } catch (error) {
      log(`Error getting memories for user ${userId}: ${error}`);
      throw error;
    }
  }

  async getMemoryById(memoryId: number): Promise<Memory | undefined> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      const [memory] = await db.select()
        .from(memories)
        .where(eq(memories.id, memoryId));
      
      return memory;
    } catch (error) {
      log(`Error getting memory by ID ${memoryId}: ${error}`);
      throw error;
    }
  }

  async updateMemory(memoryId: number, content?: string, summary?: string): Promise<Memory> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      // Prepare update data
      const updateData: Partial<InsertMemory> = {};
      if (content !== undefined) updateData.content = content;
      if (summary !== undefined) updateData.summary = summary;
      
      if (Object.keys(updateData).length === 0) {
        throw new Error("No update data provided");
      }
      
      // Update memory
      const [updatedMemory] = await db.update(memories)
        .set(updateData)
        .where(eq(memories.id, memoryId))
        .returning();
      
      if (!updatedMemory) {
        throw new Error("Memory not found");
      }
      
      return updatedMemory;
    } catch (error) {
      log(`Error updating memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async deleteMemory(memoryId: number): Promise<void> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      // First delete related records in other tables
      await db.delete(memoryKeywords).where(eq(memoryKeywords.memoryId, memoryId));
      await db.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, memoryId));
      
      // Then delete the memory itself
      await db.delete(memories).where(eq(memories.id, memoryId));
      
      log(`Memory ${memoryId} deleted successfully`);
    } catch (error) {
      log(`Error deleting memory ${memoryId}: ${error}`);
      throw error;
    }
  }
  
  // Memory keywords methods
  async addKeywordToMemory(memoryId: number | string, keyword: string): Promise<MemoryKeyword> {
    try {
      // 确保memoryId是字符串类型，与数据库表schema定义一致
      const memoryIdStr = String(memoryId);
      
      if (!keyword || typeof keyword !== 'string') {
        throw new Error("Invalid keyword");
      }
      
      // Insert keyword record
      const [memoryKeyword] = await db.insert(memoryKeywords)
        .values({
          memoryId: memoryIdStr,
          keyword: keyword.trim().toLowerCase()
        })
        .returning();
      
      return memoryKeyword;
    } catch (error) {
      log(`Error adding keyword to memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async getKeywordsByMemoryId(memoryId: number | string): Promise<MemoryKeyword[]> {
    try {
      // 确保memoryId是字符串类型，与数据库表schema定义一致
      const memoryIdStr = String(memoryId);
      
      // Get all keywords for a memory
      return await db.select()
        .from(memoryKeywords)
        .where(eq(memoryKeywords.memoryId, memoryIdStr));
    } catch (error) {
      log(`Error getting keywords for memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async deleteKeywordsByMemoryId(memoryId: number | string): Promise<void> {
    try {
      // 确保memoryId是字符串类型，与数据库表schema定义一致
      const memoryIdStr = String(memoryId);
      
      // Delete all keywords for a memory
      await db.delete(memoryKeywords)
        .where(eq(memoryKeywords.memoryId, memoryIdStr));
      
      log(`All keywords for memory ${memoryId} deleted`);
    } catch (error) {
      log(`Error deleting keywords for memory ${memoryId}: ${error}`);
      throw error;
    }
  }
  
  // Memory embeddings methods
  async saveMemoryEmbedding(memoryId: number | string, vectorData: number[]): Promise<MemoryEmbedding> {
    try {
      if (!memoryId) {
        throw new Error("Invalid memory ID");
      }
      
      if (!Array.isArray(vectorData) || vectorData.length === 0) {
        throw new Error("Invalid vector data");
      }

      // 确保将memoryId转换为字符串
      const memoryIdStr = String(memoryId);

      // Check if embedding already exists
      const existing = await this.getEmbeddingByMemoryId(memoryIdStr);
      
      if (existing) {
        // Update existing embedding
        const [updatedEmbedding] = await db.update(memoryEmbeddings)
          .set({ vectorData })
          .where(eq(memoryEmbeddings.memoryId, memoryIdStr))
          .returning();
        
        return updatedEmbedding;
      } else {
        // Insert new embedding
        const [embedding] = await db.insert(memoryEmbeddings)
          .values({
            memoryId: memoryIdStr,
            vectorData
          })
          .returning();
        
        return embedding;
      }
    } catch (error) {
      log(`Error saving embedding for memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async getEmbeddingByMemoryId(memoryId: number | string): Promise<MemoryEmbedding | undefined> {
    try {
      if (!memoryId) {
        throw new Error("Invalid memory ID");
      }
      
      // 确保将memoryId转换为字符串
      const memoryIdStr = String(memoryId);
      
      const [embedding] = await db.select()
        .from(memoryEmbeddings)
        .where(eq(memoryEmbeddings.memoryId, memoryIdStr));
      
      return embedding;
    } catch (error) {
      log(`Error getting embedding for memory ${memoryId}: ${error}`);
      return undefined;
    }
  }

  async findSimilarMemories(userId: number, vectorData: number[], limit: number = 5): Promise<Memory[]> {
    try {
      if (!userId || isNaN(userId)) {
        throw new Error("Invalid user ID");
      }
      
      if (!Array.isArray(vectorData) || vectorData.length === 0) {
        throw new Error("Invalid vector data");
      }
      
      // Get all memories with embeddings for the user
      const userMemoriesWithEmbeddings = await db.select({
        memory: memories,
        embedding: memoryEmbeddings.vectorData
      })
      .from(memories)
      .innerJoin(
        memoryEmbeddings,
        eq(memories.id, memoryEmbeddings.memoryId)
      )
      .where(eq(memories.userId, userId));
      
      // Calculate cosine similarity for each memory
      const scoredMemories = userMemoriesWithEmbeddings.map(item => {
        const similarity = this.cosineSimilarity(vectorData, item.embedding as number[]);
        return {
          memory: item.memory,
          similarity
        };
      });
      
      // Sort by similarity (descending) and take top matches
      scoredMemories.sort((a, b) => b.similarity - a.similarity);
      
      return scoredMemories.slice(0, limit).map(item => item.memory);
    } catch (error) {
      log(`Error finding similar memories for user ${userId}: ${error}`);
      throw error;
    }
  }
  
  // Utility method to calculate cosine similarity
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    try {
      if (vec1.length !== vec2.length) {
        throw new Error(`Vector dimensions don't match: ${vec1.length} vs ${vec2.length}`);
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
      
      const mag = mag1 * mag2;
      
      return mag === 0 ? 0 : dotProduct / mag;
    } catch (error) {
      log(`Error calculating cosine similarity: ${error}`);
      return 0;
    }
  }

  // Prompt template methods
  async getPromptTemplate(modelId: string): Promise<PromptTemplate | undefined> {
    try {
      if (!modelId || typeof modelId !== 'string') {
        throw new Error("Invalid model ID");
      }
      
      const [template] = await db.select()
        .from(promptTemplates)
        .where(eq(promptTemplates.modelId, modelId));
      
      return template;
    } catch (error) {
      log(`Error getting prompt template for model ${modelId}: ${error}`);
      throw error;
    }
  }

  async createOrUpdatePromptTemplate(
    modelId: string, 
    template: string, 
    userId: number,
    baseTemplate?: string,
    kTemplate?: string,
    wTemplate?: string,
    lTemplate?: string,
    qTemplate?: string,
    styleTemplate?: string,
    policyTemplate?: string,
    sensitiveWords?: string
  ): Promise<PromptTemplate> {
    try {
      if (!modelId || typeof modelId !== 'string') {
        throw new Error("Invalid model ID");
      }
      
      if (!template || typeof template !== 'string') {
        throw new Error("Invalid prompt template");
      }

      // 检查是否存在现有模板
      const existingTemplate = await this.getPromptTemplate(modelId);
      
      // 新的模板信息（用于更新或创建）
      const templateInfo: any = {
        promptTemplate: template,
        updatedAt: new Date(),
        createdBy: userId
      };
      
      // 只添加有值的字段
      if (baseTemplate !== undefined) templateInfo.baseTemplate = baseTemplate;
      if (kTemplate !== undefined) templateInfo.kTemplate = kTemplate;
      if (wTemplate !== undefined) templateInfo.wTemplate = wTemplate;
      if (lTemplate !== undefined) templateInfo.lTemplate = lTemplate;
      if (qTemplate !== undefined) templateInfo.qTemplate = qTemplate;
      if (styleTemplate !== undefined) templateInfo.styleTemplate = styleTemplate;
      if (policyTemplate !== undefined) templateInfo.policyTemplate = policyTemplate;
      if (sensitiveWords !== undefined) templateInfo.sensitiveWords = sensitiveWords;
      
      if (existingTemplate) {
        // 更新现有模板
        const [updatedTemplate] = await db.update(promptTemplates)
          .set(templateInfo)
          .where(eq(promptTemplates.modelId, modelId))
          .returning();
        
        log(`更新了模型 ${modelId} 的提示词模板`);
        return updatedTemplate;
      } else {
        // 创建新模板 - 设置默认值
        if (!templateInfo.baseTemplate) templateInfo.baseTemplate = "";
        if (!templateInfo.kTemplate) templateInfo.kTemplate = "";
        if (!templateInfo.wTemplate) templateInfo.wTemplate = "";
        if (!templateInfo.lTemplate) templateInfo.lTemplate = "";
        if (!templateInfo.qTemplate) templateInfo.qTemplate = "";
        if (!templateInfo.styleTemplate) templateInfo.styleTemplate = "";
        if (!templateInfo.policyTemplate) templateInfo.policyTemplate = "";
        if (!templateInfo.sensitiveWords) templateInfo.sensitiveWords = "";
        
        // 插入记录
        const [newTemplate] = await db.insert(promptTemplates)
          .values({
            modelId,
            ...templateInfo
          })
          .returning();
        
        log(`创建了模型 ${modelId} 的新提示词模板`);
        return newTemplate;
      }
    } catch (error) {
      log(`创建/更新提示词模板错误 (${modelId}): ${error}`);
      throw error;
    }
  }

  async getAllPromptTemplates(): Promise<PromptTemplate[]> {
    try {
      return await db.select().from(promptTemplates);
    } catch (error) {
      log(`Error getting all prompt templates: ${error}`);
      throw error;
    }
  }

  async deletePromptTemplate(modelId: string): Promise<void> {
    try {
      if (!modelId || typeof modelId !== 'string') {
        throw new Error("Invalid model ID");
      }
      
      await db.delete(promptTemplates)
        .where(eq(promptTemplates.modelId, modelId));
      
      log(`Prompt template deleted for model ${modelId}`);
    } catch (error) {
      log(`Error deleting prompt template for model ${modelId}: ${error}`);
      throw error;
    }
  }

  // Search results methods
  async saveSearchResult(query: string, results: any, expiryMinutes: number = 60): Promise<SearchResult> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error("Invalid search query");
      }
      
      if (!results) {
        throw new Error("Invalid search results");
      }
      
      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);
      
      // 尝试更新现有结果
      const existingResult = await this.getSearchResult(query);
      
      if (existingResult) {
        // 更新现有记录
        const [updatedResult] = await db.update(searchResults)
          .set({
            results,
            createdAt: new Date(),
            expiresAt
          })
          .where(eq(searchResults.query, query))
          .returning();
        
        log(`Search result updated for query: ${query}`);
        return updatedResult;
      } else {
        // 创建新记录
        const [newResult] = await db.insert(searchResults)
          .values({
            query,
            results,
            expiresAt
          })
          .returning();
        
        log(`New search result saved for query: ${query}`);
        return newResult;
      }
    } catch (error) {
      log(`Error saving search result for query ${query}: ${error}`);
      throw error;
    }
  }

  async getSearchResult(query: string): Promise<SearchResult | undefined> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error("Invalid search query");
      }
      
      // 获取未过期的搜索结果
      const [result] = await db.select()
        .from(searchResults)
        .where(
          and(
            eq(searchResults.query, query),
            sql`${searchResults.expiresAt} > NOW()`
          )
        );
      
      return result;
    } catch (error) {
      log(`Error getting search result for query ${query}: ${error}`);
      throw error;
    }
  }

  async deleteExpiredSearchResults(): Promise<number> {
    try {
      // 删除已过期的搜索结果
      const result = await db.delete(searchResults)
        .where(sql`${searchResults.expiresAt} <= NOW()`)
        .returning();
      
      const count = result.length;
      log(`Deleted ${count} expired search results`);
      
      return count;
    } catch (error) {
      log(`Error deleting expired search results: ${error}`);
      throw error;
    }
  }

  // 会话分析方法
  async saveConversationAnalytic(
    chatId: number, 
    currentPhase: "K" | "W" | "L" | "Q", 
    summary: string
  ): Promise<ConversationAnalytic> {
    try {
      if (!chatId || isNaN(chatId)) {
        throw new Error("无效的聊天ID");
      }
      
      if (!currentPhase || !["K", "W", "L", "Q"].includes(currentPhase)) {
        throw new Error("无效的对话阶段");
      }
      
      if (!summary || typeof summary !== 'string') {
        throw new Error("无效的对话摘要");
      }
      
      // 创建新的对话分析记录
      const [analytic] = await db.insert(conversationAnalytics)
        .values({
          chatId,
          currentPhase,
          summary,
          timestamp: new Date()
        })
        .returning();
      
      log(`为聊天 ${chatId} 创建了新的对话阶段分析: ${currentPhase}`);
      return analytic;
    } catch (error) {
      log(`创建对话阶段分析错误: ${error}`);
      throw error;
    }
  }
  
  async getLatestConversationAnalytic(chatId: number): Promise<ConversationAnalytic | undefined> {
    try {
      if (!chatId || isNaN(chatId)) {
        throw new Error("无效的聊天ID");
      }
      
      // 获取最新的对话分析
      const [analytic] = await db.select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.chatId, chatId))
        .orderBy(desc(conversationAnalytics.timestamp))
        .limit(1);
      
      return analytic;
    } catch (error) {
      log(`获取最新对话阶段分析错误: ${error}`);
      throw error;
    }
  }
  
  async getConversationAnalyticHistory(chatId: number): Promise<ConversationAnalytic[]> {
    try {
      if (!chatId || isNaN(chatId)) {
        throw new Error("无效的聊天ID");
      }
      
      // 获取对话分析历史
      const analytics = await db.select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.chatId, chatId))
        .orderBy(desc(conversationAnalytics.timestamp));
      
      return analytics;
    } catch (error) {
      log(`获取对话阶段分析历史错误: ${error}`);
      throw error;
    }
  }

  // System config methods
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    try {
      const [config] = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.key, key));
      return config;
    } catch (error) {
      log(`Error getting system config: ${error}`);
      throw error;
    }
  }

  async getAllSystemConfigs(): Promise<SystemConfig[]> {
    try {
      return await db.select()
        .from(systemConfig)
        .orderBy(asc(systemConfig.key));
    } catch (error) {
      log(`Error getting all system configs: ${error}`);
      throw error;
    }
  }

  async upsertSystemConfig(key: string, value: string, description?: string, updatedBy?: number): Promise<SystemConfig> {
    try {
      // 尝试获取现有配置
      const existingConfig = await this.getSystemConfig(key);
      
      if (existingConfig) {
        // 更新现有配置
        const [updatedConfig] = await db.update(systemConfig)
          .set({ 
            value, 
            description: description || existingConfig.description,
            updatedAt: new Date(),
            updatedBy: updatedBy || existingConfig.updatedBy
          })
          .where(eq(systemConfig.key, key))
          .returning();
        return updatedConfig;
      } else {
        // 创建新配置
        const [newConfig] = await db.insert(systemConfig)
          .values({ 
            key, 
            value, 
            description,
            updatedAt: new Date(),
            updatedBy 
          })
          .returning();
        return newConfig;
      }
    } catch (error) {
      log(`Error upserting system config: ${error}`);
      throw error;
    }
  }
}

// Export a single instance of the storage
export const storage = new DatabaseStorage();