import { 
  users, type User, type InsertUser, 
  chats, messages, type Chat, type Message,
  memories, memoryKeywords, memoryEmbeddings,
  type Memory, type MemoryKeyword, type MemoryEmbedding,
  type InsertMemory, type InsertMemoryKeyword, type InsertMemoryEmbedding
} from "@shared/schema";
import { db } from "./db";
import { eq, ne, and, asc, desc, sql, inArray } from "drizzle-orm";
import { log } from "./vite";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
  updateUserRole(userId: number, role: "admin" | "user"): Promise<void>;
  deleteUser(userId: number): Promise<void>;

  // Chat methods
  createChat(userId: number, title: string, model: string): Promise<Chat>;
  getUserChats(userId: number, isAdmin: boolean): Promise<(Chat & { username?: string })[]>;
  deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void>;
  getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined>;
  updateChatTitle(chatId: number, title: string): Promise<void>;
  updateChatModel(chatId: number, model: string): Promise<void>;

  // Message methods
  createMessage(chatId: number, content: string, role: string): Promise<Message>;
  getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]>;
  updateMessage(messageId: number, content: string, isUserOwned: boolean): Promise<Message>;
  updateMessageFeedback(messageId: number, feedback: "like" | "dislike"): Promise<Message>;
  regenerateMessage(messageId: number): Promise<Message>;
  getMessageById(messageId: number): Promise<Message | undefined>; // Added method

  // Memory methods
  createMemory(userId: number, content: string, type?: string, summary?: string): Promise<Memory>;
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
      await db.delete(users).where(eq(users.id, userId));
    } catch (error) {
      log(`Error deleting user: ${error}`);
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
      // First verify if the user has access to this chat
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) return;

      // First delete all messages in the chat
      await db.delete(messages).where(eq(messages.chatId, chatId));
      // Then delete the chat itself
      await db.delete(chats).where(eq(chats.id, chatId));
    } catch (error) {
      log(`Error deleting chat: ${error}`);
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

  async createMessage(chatId: number, content: string, role: string): Promise<Message> {
    try {
      const [message] = await db.insert(messages)
        .values({ chatId, content, role })
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
  async updateMessage(messageId: number, content: string, isUserOwned: boolean = false): Promise<Message> {
    try {
      // 如果是用户更新消息，需要确保只能更新用户自己的消息
      const condition = isUserOwned ? eq(messages.role, "user") : undefined;

      // 更新消息
      const results = await db
        .update(messages)
        .set({ content, isEdited: true })
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
  async createMemory(userId: number, content: string, type: string = "chat", summary?: string): Promise<Memory> {
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
          timestamp: new Date()
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
  async addKeywordToMemory(memoryId: number, keyword: string): Promise<MemoryKeyword> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      if (!keyword || typeof keyword !== 'string') {
        throw new Error("Invalid keyword");
      }
      
      // Insert keyword record
      const [memoryKeyword] = await db.insert(memoryKeywords)
        .values({
          memoryId,
          keyword: keyword.trim().toLowerCase()
        })
        .returning();
      
      return memoryKeyword;
    } catch (error) {
      log(`Error adding keyword to memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async getKeywordsByMemoryId(memoryId: number): Promise<MemoryKeyword[]> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      // Get all keywords for a memory
      return await db.select()
        .from(memoryKeywords)
        .where(eq(memoryKeywords.memoryId, memoryId));
    } catch (error) {
      log(`Error getting keywords for memory ${memoryId}: ${error}`);
      throw error;
    }
  }

  async deleteKeywordsByMemoryId(memoryId: number): Promise<void> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      // Delete all keywords for a memory
      await db.delete(memoryKeywords)
        .where(eq(memoryKeywords.memoryId, memoryId));
      
      log(`All keywords for memory ${memoryId} deleted`);
    } catch (error) {
      log(`Error deleting keywords for memory ${memoryId}: ${error}`);
      throw error;
    }
  }
  
  // Memory embeddings methods
  async saveMemoryEmbedding(memoryId: number, vectorData: number[]): Promise<MemoryEmbedding> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      if (!Array.isArray(vectorData) || vectorData.length === 0) {
        throw new Error("Invalid vector data");
      }

      // Check if embedding already exists
      const existing = await this.getEmbeddingByMemoryId(memoryId);
      
      if (existing) {
        // Update existing embedding
        const [updatedEmbedding] = await db.update(memoryEmbeddings)
          .set({ vectorData })
          .where(eq(memoryEmbeddings.memoryId, memoryId))
          .returning();
        
        return updatedEmbedding;
      } else {
        // Insert new embedding
        const [embedding] = await db.insert(memoryEmbeddings)
          .values({
            memoryId,
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

  async getEmbeddingByMemoryId(memoryId: number): Promise<MemoryEmbedding | undefined> {
    try {
      if (!memoryId || isNaN(memoryId)) {
        throw new Error("Invalid memory ID");
      }
      
      const [embedding] = await db.select()
        .from(memoryEmbeddings)
        .where(eq(memoryEmbeddings.memoryId, memoryId));
      
      return embedding;
    } catch (error) {
      log(`Error getting embedding for memory ${memoryId}: ${error}`);
      throw error;
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
}

// Export a single instance of the storage
export const storage = new DatabaseStorage();