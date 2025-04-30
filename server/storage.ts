import { 
  users, type User, type InsertUser, 
  chats, messages, type Chat, type Message,
  memories, memoryKeywords, memoryEmbeddings,
  promptTemplates, searchResults, conversationAnalytics,
  userFiles, userSettings, systemConfig,
  knowledgeGraphCache, clusterResultCache, learningPaths,
  type Memory, type MemoryKeyword, type MemoryEmbedding,
  type InsertMemory, type InsertMemoryKeyword, type InsertMemoryEmbedding,
  type PromptTemplate, type SearchResult, type ConversationAnalytic,
  type SystemConfig, type KnowledgeGraphCache, type ClusterResultCache, type LearningPath,
  type InsertLearningPath, type UserSetting, type UserFile,
  // 添加学生智能体相关导入
  studentAgentPresets, studentAgentSessions, studentAgentMessages, studentAgentEvaluations,
  type StudentAgentPreset, type StudentAgentSession, type StudentAgentMessage, type StudentAgentEvaluation,
  type InsertStudentAgentPreset, type InsertStudentAgentSession, type InsertStudentAgentMessage, type InsertStudentAgentEvaluation
} from "@shared/schema";
import { db } from "./db";
import { 
  eq, ne, and, asc, desc, sql, inArray, isNotNull, count, or, isNull
} from "drizzle-orm";
import { sql as sqlExpr } from "drizzle-orm/sql";
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
  
  // User Settings methods
  getUserSettings(userId: number): Promise<UserSetting | undefined>;
  saveUserSettings(userId: number, settings: {
    theme?: string;
    font_size?: string;
    background_file?: string;
  }): Promise<UserSetting>;
  
  // User Files methods
  checkUserFileExists(userId: number, fileId: string): Promise<boolean>;
  getUserFiles(userId: number, fileType?: string): Promise<UserFile[]>;
  
  // System config methods
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  getAllSystemConfigs(): Promise<SystemConfig[]>;
  upsertSystemConfig(key: string, value: string, description?: string, updatedBy?: number): Promise<SystemConfig>;

  // Chat methods
  createChat(userId: number, title: string, model: string): Promise<Chat>;
  getUserChats(userId: number, isAdmin: boolean): Promise<(Chat & { username?: string })[]>;
  deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void>;
  getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined>;
  getChat(chatId: number): Promise<Chat | undefined>; // 获取聊天，不检查权限
  updateChatTitle(chatId: number, title: string): Promise<void>;
  updateChatModel(chatId: number, model: string): Promise<void>;
  updateChatMetadata(chatId: number, metadata: Record<string, any>): Promise<void>; // 更新聊天元数据

  // Message methods
  createMessage(chatId: number, content: string, role: string, model?: string): Promise<Message>;
  getChatMessages(chatId: number, userId: number, isAdmin: boolean, activeOnly?: boolean): Promise<Message[]>;
  updateMessage(messageId: number, content: string, isUserOwned: boolean, model?: string): Promise<Message>;
  updateMessageFeedback(messageId: number, feedback: "like" | "dislike", feedbackText?: string): Promise<Message>;
  regenerateMessage(messageId: number): Promise<Message>;
  getMessageById(messageId: number): Promise<Message | undefined>;
  // 添加标记消息为非活跃的方法
  deactivateMessagesAfter(chatId: number, messageId: number): Promise<void>;

  // Memory methods
  createMemory(userId: number, content: string, type?: string, summary?: string, timestamp?: Date): Promise<Memory>;
  getMemoriesByUserId(userId: number): Promise<Memory[]>;
  getMemoryById(memoryId: number | string): Promise<Memory | undefined>;
  updateMemory(memoryId: number | string, content?: string, summary?: string): Promise<Memory>;
  deleteMemory(memoryId: number | string): Promise<void>;
  
  // Memory keywords methods
  addKeywordToMemory(memoryId: number | string, keyword: string): Promise<MemoryKeyword>;
  getKeywordsByMemoryId(memoryId: number | string): Promise<MemoryKeyword[]>;
  deleteKeywordsByMemoryId(memoryId: number | string): Promise<void>;
  
  // Memory embeddings methods
  saveMemoryEmbedding(memoryId: number | string, vectorData: number[]): Promise<MemoryEmbedding>;
  getEmbeddingByMemoryId(memoryId: number | string): Promise<MemoryEmbedding | undefined>;
  getEmbeddingsByMemoryIds(memoryIds: (number | string)[]): Promise<Record<string, MemoryEmbedding>>;
  findSimilarMemories(userId: number, vectorData: number[], limit?: number): Promise<Memory[]>;
  
  // Knowledge graph methods
  saveKnowledgeGraphCache(
    userId: number, 
    nodes: any[], 
    links: any[], 
    expiryHours?: number
  ): Promise<KnowledgeGraphCache>;
  getKnowledgeGraphCache(userId: number): Promise<KnowledgeGraphCache | undefined>;
  clearKnowledgeGraphCache(userId: number): Promise<void>;
  
  // Cluster result methods
  saveClusterResultCache(
    userId: number,
    clusterData: any,
    clusterCount: number,
    vectorCount: number,
    expiryHours?: number
  ): Promise<ClusterResultCache>;
  getClusterResultCache(userId: number): Promise<ClusterResultCache | undefined>;
  clearClusterResultCache(userId: number): Promise<void>;
  
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
  
  // Learning path methods
  saveLearningPath(
    userId: number,
    topics: any[],
    distribution: any[],
    suggestions: string[],
    knowledgeGraph?: any,
    progressHistory?: any[],
    isOptimized?: boolean
  ): Promise<LearningPath>;
  getLearningPath(userId: number): Promise<LearningPath | undefined>;
  updateLearningPathHistory(userId: number, newProgressEntry: any): Promise<LearningPath | undefined>;
  clearLearningPath(userId: number): Promise<void>;
  
  // 学生智能体配置方法
  createStudentAgentPreset(preset: InsertStudentAgentPreset): Promise<StudentAgentPreset>;
  updateStudentAgentPreset(presetId: number, updates: Partial<StudentAgentPreset>): Promise<StudentAgentPreset>;
  getStudentAgentPreset(presetId: number): Promise<StudentAgentPreset | undefined>;
  getAllStudentAgentPresets(): Promise<StudentAgentPreset[]>;
  deleteStudentAgentPreset(presetId: number): Promise<void>;
  
  // 学生智能体会话方法
  createStudentAgentSession(
    userId: number, 
    presetId: number, 
    learningTopic: string,
    name?: string
  ): Promise<StudentAgentSession>;
  getStudentAgentSession(sessionId: number): Promise<StudentAgentSession | undefined>;
  getStudentAgentSessionsByUser(userId: number): Promise<StudentAgentSession[]>;
  updateStudentAgentSessionState(
    sessionId: number, 
    currentState: any, 
    motivationLevel?: number,
    confusionLevel?: number
  ): Promise<StudentAgentSession>;
  completeStudentAgentSession(sessionId: number): Promise<void>;
  
  // 学生智能体消息方法
  createStudentAgentMessage(
    sessionId: number, 
    content: string, 
    role: "student" | "tutor" | "system",
    stateSnapshot?: any,
    kwlqUpdateType?: "K" | "W" | "L" | "Q" | "none",
    kwlqUpdateContent?: string
  ): Promise<StudentAgentMessage>;
  getStudentAgentSessionMessages(sessionId: number): Promise<StudentAgentMessage[]>;
  
  // 学生智能体评估方法
  createStudentAgentEvaluation(
    sessionId: number,
    evaluatorId: number,
    realismScore: number,
    learningTrajectoryScore: number,
    kwlqCompletionRate: number,
    languageDiversityScore?: number,
    comments?: string
  ): Promise<StudentAgentEvaluation>;
  getStudentAgentEvaluationsBySession(sessionId: number): Promise<StudentAgentEvaluation[]>;
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
        
        // 10. 删除知识图谱缓存
        log(`删除用户 ${userId} 的知识图谱缓存`);
        await tx.delete(knowledgeGraphCache).where(eq(knowledgeGraphCache.userId, userId));
        
        // 11. 删除聚类结果缓存
        log(`删除用户 ${userId} 的聚类结果缓存`);
        await tx.delete(clusterResultCache).where(eq(clusterResultCache.userId, userId));
        
        // 12. 删除学习轨迹数据
        log(`删除用户 ${userId} 的学习轨迹数据`);
        await tx.delete(learningPaths).where(eq(learningPaths.userId, userId));
        
        // 13. 最后删除用户本身
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
  
  // User Settings methods
  async getUserSettings(userId: number): Promise<UserSetting | undefined> {
    try {
      log(`[用户设置] 获取用户 ${userId} 的设置`);
      const [settings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      return settings;
    } catch (error) {
      log(`[用户设置] 获取设置出错: ${error}`, 'error');
      throw error;
    }
  }
  
  // User Files methods
  async checkUserFileExists(userId: number, fileId: string): Promise<boolean> {
    try {
      log(`[用户文件] 检查文件ID=${fileId}是否属于用户ID=${userId}`);
      
      const query = { where: and(eq(userFiles.userId, userId), eq(userFiles.fileId, fileId)) };
      const file = await db.query.userFiles.findFirst(query);
      
      const exists = !!file;
      log(`[用户文件] 文件ID=${fileId}${exists ? '存在' : '不存在'}`);
      return exists;
    } catch (error) {
      log(`[用户文件] 检查文件存在性出错: ${error}`, 'error');
      // 发生错误时返回false，而不是抛出异常
      return false;
    }
  }
  
  async getUserFiles(userId: number, fileType?: string): Promise<UserFile[]> {
    try {
      log(`[用户文件] 获取用户ID=${userId}的文件，类型=${fileType || '全部'}`);
      
      const query = { where: eq(userFiles.userId, userId) };
      const result = await db.query.userFiles.findMany(query);
      
      let files;
      if (fileType) {
        // 使用JavaScript filter而不SQL过滤
        files = result.filter(file => file.fileType === fileType);
      } else {
        files = result;
      }
      
      log(`[用户文件] 找到${files.length}个文件`);
      return files;
    } catch (error) {
      log(`[用户文件] 获取文件列表出错: ${error}`, 'error');
      return [];
    }
  }

  async saveUserSettings(userId: number, settings: {
    theme?: string;
    font_size?: string;
    background_file?: string;
  }): Promise<UserSetting> {
    try {
      log(`[用户设置] 保存用户 ${userId} 的设置: ${JSON.stringify(settings)}`);
      
      // 获取当前设置
      const currentSettings = await this.getUserSettings(userId);
      
      if (currentSettings) {
        // 更新现有设置
        log(`[用户设置] 更新现有设置，ID=${currentSettings.id}`);
        
        const updateValues: any = {};
        if (settings.theme !== undefined) updateValues.theme = settings.theme;
        if (settings.font_size !== undefined) updateValues.fontSize = settings.font_size;
        if (settings.background_file !== undefined) updateValues.backgroundFile = settings.background_file;
        updateValues.updatedAt = new Date();
        
        const [updated] = await db.update(userSettings)
          .set(updateValues)
          .where(eq(userSettings.id, currentSettings.id))
          .returning();
        
        return updated;
      } else {
        // 创建新设置
        log(`[用户设置] 用户 ${userId} 的设置不存在，创建新设置`);
        
        const insertValues: any = { userId };
        if (settings.theme !== undefined) insertValues.theme = settings.theme;
        if (settings.font_size !== undefined) insertValues.fontSize = settings.font_size;
        if (settings.background_file !== undefined) insertValues.backgroundFile = settings.background_file;
        
        const [created] = await db.insert(userSettings)
          .values(insertValues)
          .returning();
        
        return created;
      }
    } catch (error) {
      log(`[用户设置] 保存设置出错: ${error}`, 'error');
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
            metadata: chats.metadata,
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
  
  async getChat(chatId: number): Promise<Chat | undefined> {
    try {
      if (!chatId || isNaN(chatId)) {
        log(`无效的聊天ID: ${chatId}`);
        return undefined;
      }
      
      // 直接获取聊天记录，不检查权限
      const [chat] = await db.select()
        .from(chats)
        .where(eq(chats.id, chatId));
      
      return chat;
    } catch (error) {
      log(`从数据库获取聊天记录时出错: ${error}`);
      throw error;
    }
  }
  
  async updateChatMetadata(chatId: number, metadata: Record<string, any>): Promise<void> {
    try {
      if (!chatId || isNaN(chatId)) {
        log(`更新元数据时遇到无效的聊天ID: ${chatId}`);
        throw new Error("Invalid chat ID");
      }
      
      // 获取当前的聊天记录
      const chat = await this.getChat(chatId);
      if (!chat) {
        log(`无法更新元数据，聊天不存在: ${chatId}`);
        throw new Error(`Chat not found: ${chatId}`);
      }
      
      // 合并现有元数据与新提供的元数据
      const currentMetadata = chat.metadata || {};
      const newMetadata = { ...currentMetadata, ...metadata };
      
      // 更新聊天元数据
      await db.update(chats)
        .set({ metadata: newMetadata })
        .where(eq(chats.id, chatId));
      
      log(`已成功更新聊天 ${chatId} 的元数据`);
    } catch (error) {
      log(`更新聊天元数据时出错: ${error}`);
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

  async updateMessageFeedback(
    messageId: number, 
    feedback: "like" | "dislike", 
    feedbackText?: string
  ): Promise<Message> {
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

      // 准备更新字段
      const updateFields: any = { feedback };
      
      // 如果提供了文本反馈，也进行更新
      if (feedbackText) {
        updateFields.feedbackText = feedbackText;
      }

      // 更新消息反馈
      const [updatedMessage] = await db.update(messages)
        .set(updateFields)
        .where(eq(messages.id, messageId))
        .returning();

      log(`Feedback ${feedback} applied to message ${messageId}${feedbackText ? ' with text feedback' : ''}`);
      return updatedMessage;
    } catch (error) {
      log(`Error updating message feedback: ${error}`);
      throw error;
    }
  }
  
  // 用于管理员后台的反馈分析 - 获取所有用户反馈统计
  async getFeedbackStats(): Promise<{
    totalMessages: number,
    totalFeedback: number,
    likesCount: number,
    dislikesCount: number,
    feedbackPercentage: number,
    userFeedbackStats: {
      userId: number,
      username: string,
      totalFeedback: number,
      likes: number,
      dislikes: number,
      feedbackRate: number
    }[],
    modelFeedbackStats: {
      model: string,
      totalMessages: number,
      likes: number,
      dislikes: number,
      likeRate: number
    }[],
    recentFeedback: {
      id: number,
      userId: number,
      username: string,
      chatId: number,
      content: string,
      feedback: string,
      model: string,
      createdAt: string
    }[]
  }> {
    try {
      // 使用Drizzle ORM API获取统计数据
      
      // 1. 获取总AI消息数
      const totalMessagesResult = await db
        .select({ value: count() })
        .from(messages)
        .where(eq(messages.role, "assistant"));
      
      const totalMessages = Number(totalMessagesResult[0]?.value || 0);
      
      // 2. 获取有反馈的消息统计
      const feedbackStatsResult = await db
        .select({
          total: count(),
          likes: count(
            and(
              eq(messages.feedback, "like"),
              isNotNull(messages.feedback)
            )
          ),
          dislikes: count(
            and(
              eq(messages.feedback, "dislike"),
              isNotNull(messages.feedback)
            )
          )
        })
        .from(messages)
        .where(
          and(
            eq(messages.role, "assistant"),
            isNotNull(messages.feedback)
          )
        );
      
      const feedbackStats = feedbackStatsResult[0] || { total: 0, likes: 0, dislikes: 0 };
      
      // 3. 按用户统计反馈
      const userStats = await db
        .select({
          userId: chats.userId,
          username: users.username,
          total: count(),
          likes: count(
            and(
              eq(messages.feedback, "like")
            )
          ),
          dislikes: count(
            and(
              eq(messages.feedback, "dislike")
            )
          )
        })
        .from(messages)
        .innerJoin(chats, eq(messages.chatId, chats.id))
        .innerJoin(users, eq(chats.userId, users.id))
        .where(
          and(
            eq(messages.role, "assistant"),
            isNotNull(messages.feedback)
          )
        )
        .groupBy(chats.userId, users.username);
      
      // 4. 按模型统计反馈
      const modelStats = await db
        .select({
          model: messages.model,
          total: count(),
          likes: count(
            and(
              eq(messages.feedback, "like")
            )
          ),
          dislikes: count(
            and(
              eq(messages.feedback, "dislike")
            )
          )
        })
        .from(messages)
        .where(eq(messages.role, "assistant"))
        .groupBy(messages.model);
      
      // 5. 获取最近的反馈消息
      const recentFeedbackData = await db
        .select({
          id: messages.id,
          chatId: messages.chatId,
          content: messages.content,
          feedback: messages.feedback,
          model: messages.model,
          createdAt: messages.createdAt,
          userId: chats.userId,
          username: users.username
        })
        .from(messages)
        .innerJoin(chats, eq(messages.chatId, chats.id))
        .innerJoin(users, eq(chats.userId, users.id))
        .where(
          and(
            eq(messages.role, "assistant"),
            isNotNull(messages.feedback)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(10);
      
      // 处理用户统计数据
      const userFeedbackStats = userStats.map(row => {
        const totalFeedback = Number(row.total);
        const likes = Number(row.likes);
        return {
          userId: Number(row.userId),
          username: row.username || `用户 ${row.userId}`,
          totalFeedback,
          likes,
          dislikes: Number(row.dislikes),
          feedbackRate: totalFeedback > 0 ? likes / totalFeedback : 0
        };
      });
      
      // 处理模型统计数据
      const modelFeedbackStats = modelStats.map(row => {
        const likes = Number(row.likes);
        const dislikes = Number(row.dislikes);
        const total = likes + dislikes;
        return {
          model: row.model || "未指定",
          totalMessages: Number(row.total),
          likes,
          dislikes,
          likeRate: total > 0 ? likes / total : 0
        };
      });
      
      // 处理最近反馈数据
      const recentFeedback = recentFeedbackData.map(row => ({
        id: Number(row.id),
        userId: Number(row.userId),
        username: row.username || "未知用户",
        chatId: Number(row.chatId),
        content: row.content || "",
        feedback: row.feedback || "未指定",
        model: row.model || "未指定",
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString()
      }));
      
      // 计算总体统计数据
      const totalFeedback = Number(feedbackStats.total);
      const likesCount = Number(feedbackStats.likes);
      const dislikesCount = Number(feedbackStats.dislikes);
      const feedbackPercentage = totalMessages > 0 ? (totalFeedback / totalMessages) * 100 : 0;
      
      return {
        totalMessages,
        totalFeedback,
        likesCount,
        dislikesCount,
        feedbackPercentage,
        userFeedbackStats,
        modelFeedbackStats,
        recentFeedback
      };
    } catch (error) {
      log(`Error getting feedback statistics: ${error}`);
      throw error;
    }
  }
  
  // 实现将指定消息之后的所有消息设为非活跃状态的方法
  async deactivateMessagesAfter(chatId: number, messageId: number): Promise<void> {
    try {
      // 获取当前消息以确认它存在
      const message = await this.getMessageById(messageId);
      if (!message) {
        throw new Error(`Message with ID ${messageId} not found`);
      }
      
      // 确认消息属于指定的聊天
      if (message.chatId !== chatId) {
        throw new Error(`Message ${messageId} does not belong to chat ${chatId}`);
      }
      
      // 查找此消息之后的所有消息（按照创建时间排序）
      const allMessages = await db.select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(asc(messages.createdAt));
      
      // 查找消息在列表中的位置
      const messageIndex = allMessages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error(`Message ${messageId} not found in chat ${chatId}`);
      }
      
      // 获取此消息之后的所有消息ID
      const laterMessagesIds = allMessages
        .slice(messageIndex + 1)
        .map(msg => msg.id);
      
      if (laterMessagesIds.length === 0) {
        // 没有后续消息需要处理
        log(`No messages to deactivate after message ${messageId} in chat ${chatId}`);
        return;
      }
      
      // 添加调试日志
      log(`尝试标记以下消息为非活跃: ${JSON.stringify(laterMessagesIds)}`);

      // 将所有后续消息标记为非活跃
      try {
        const result = await db.update(messages)
          .set({ isActive: false })
          .where(inArray(messages.id, laterMessagesIds));
        
        log(`更新结果: ${JSON.stringify(result)}`);
        log(`已将聊天 ${chatId} 中消息 ${messageId} 之后的 ${laterMessagesIds.length} 条消息标记为非活跃`);

        // 验证更新是否成功
        const verifyQuery = await db.select()
          .from(messages)
          .where(inArray(messages.id, laterMessagesIds));
        
        log(`验证更新结果: ${verifyQuery.length} 条记录, 第一条消息 isActive=${verifyQuery[0]?.isActive}`);
      } catch (updateError) {
        log(`更新消息活跃状态时出错: ${updateError}`);
        throw updateError;
      }
    } catch (error) {
      log(`Error deactivating messages: ${error}`);
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

  async getChatMessages(chatId: number, userId: number, isAdmin: boolean, activeOnly: boolean = true): Promise<Message[]> {
    try {
      // First verify if the user has access to this chat
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) return []; 

      // Only return messages if the user has access to the chat
      if (!isAdmin && chat.userId !== userId) return [];

      // 构建查询条件
      let conditions = [eq(messages.chatId, chatId)];
      
      // 如果只查询活跃消息（默认行为），添加is_active条件
      if (activeOnly) {
        conditions.push(eq(messages.isActive, true));
        log(`添加活跃消息过滤条件: isActive=true`);
      }
      
      // Get messages for a specific chat with active filter if requested
      return await db.select()
        .from(messages)
        .where(and(...conditions))
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
      
      // 生成时间戳格式的ID: YYYYMMDDHHMMSSmmmNNN (年月日时分秒毫秒+3位随机数)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      
      // 格式: YYYYMMDDHHMMSSmmmNNN
      const memoryId = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${randomSuffix}`;
      
      // Insert memory record with custom ID
      const [memory] = await db.insert(memories)
        .values({
          id: memoryId,
          userId,
          content,
          type,
          summary,
          timestamp: timestamp || now
        })
        .returning();
      
      log(`Memory created for user ${userId}, id: ${memory.id} (timestamp format)`);
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

  async getMemoryById(memoryId: number | string): Promise<Memory | undefined> {
    try {
      if (!memoryId) {
        throw new Error("Invalid memory ID");
      }
      
      // 使用字符串类型的ID
      const memoryIdStr = String(memoryId);
      
      const [memory] = await db.select()
        .from(memories)
        .where(eq(memories.id, memoryIdStr));
      
      return memory;
    } catch (error) {
      log(`Error getting memory by ID ${memoryId}: ${error}`);
      throw error;
    }
  }

  async updateMemory(memoryId: number | string, content?: string, summary?: string): Promise<Memory> {
    try {
      if (!memoryId) {
        throw new Error("Invalid memory ID");
      }
      
      // 使用字符串类型的ID
      const memoryIdStr = String(memoryId);
      
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
        .where(eq(memories.id, memoryIdStr))
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

  async deleteMemory(memoryId: number | string): Promise<void> {
    try {
      // 确保将memoryId转换为字符串类型
      const memoryIdStr = String(memoryId);
      
      // First delete related records in other tables
      await db.delete(memoryKeywords).where(eq(memoryKeywords.memoryId, memoryIdStr));
      await db.delete(memoryEmbeddings).where(eq(memoryEmbeddings.memoryId, memoryIdStr));
      
      // 然后删除记忆本身 - 注意现在memories.id是文本类型
      await db.delete(memories).where(eq(memories.id, memoryIdStr));
      
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
  
  /**
   * 批量获取多个记忆的向量嵌入，提高性能
   * @param memoryIds 记忆ID数组
   * @returns 以记忆ID为键、嵌入对象为值的映射
   */
  async getEmbeddingsByMemoryIds(memoryIds: (number | string)[]): Promise<Record<string, MemoryEmbedding>> {
    try {
      if (!memoryIds || !Array.isArray(memoryIds) || memoryIds.length === 0) {
        return {};
      }
      
      // 转换所有ID为字符串
      const memoryIdStrs = memoryIds.map(id => String(id));
      
      // 使用IN查询批量获取
      const embeddings = await db.select()
        .from(memoryEmbeddings)
        .where(inArray(memoryEmbeddings.memoryId, memoryIdStrs));
      
      // 创建ID到嵌入的映射
      const result: Record<string, MemoryEmbedding> = {};
      for (const embedding of embeddings) {
        result[embedding.memoryId] = embedding;
      }
      
      return result;
    } catch (error) {
      log(`Error getting embeddings by memory IDs: ${error}`);
      return {}; // 返回空对象而不是抛出异常，避免影响调用链
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
        // 两者都是字符串类型，直接比较即可
        eq(memoryEmbeddings.memoryId, memories.id)
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
  
  // 学习轨迹方法实现
  async saveLearningPath(
    userId: number,
    topics: any[],
    distribution: any[],
    suggestions: string[],
    knowledgeGraph?: any,
    progressHistory?: any[],
    isOptimized?: boolean,
    expiryHours: number = 168 // 默认1周过期，与聚类缓存保持一致
  ): Promise<LearningPath> {
    try {
      if (!userId || isNaN(userId)) {
        log(`保存学习轨迹失败: 无效的用户ID ${userId}`);
        throw new Error("Invalid user ID");
      }
      
      log(`[storage-debug] 保存用户 ${userId} 的学习轨迹数据，${topics?.length || 0} 个主题，${suggestions?.length || 0} 个建议`);
      console.log(`[DEBUG] 保存学习轨迹: 用户ID=${userId}, 主题数=${topics?.length || 0}, 建议数=${suggestions?.length || 0}`);
      
      // 数据安全处理 - 确保有有效的数组数据
      const safeTopics = Array.isArray(topics) ? topics.map((t: any) => ({
        id: (t.id && typeof t.id === 'string') ? t.id : `topic_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        topic: (t.topic && typeof t.topic === 'string') ? t.topic : '未知主题',
        percentage: (t.percentage && typeof t.percentage === 'number') ? t.percentage : 0.1
      })) : [];
      
      const safeDistribution = Array.isArray(distribution) ? distribution.map((d: any) => ({
        id: (d.id && typeof d.id === 'string') ? d.id : `dist_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        topic: (d.topic && typeof d.topic === 'string') ? d.topic : '未知主题',
        percentage: (d.percentage && typeof d.percentage === 'number') ? d.percentage : 0.1
      })) : safeTopics;
      
      const safeSuggestions = Array.isArray(suggestions) ? 
        suggestions.filter((s: any) => typeof s === 'string').slice(0, 10) : 
        ['继续探索您感兴趣的主题', '尝试将学到的知识应用到实际中'];
      
      const safeKnowledgeGraph = knowledgeGraph ? {
        nodes: Array.isArray(knowledgeGraph.nodes) ? knowledgeGraph.nodes.map((n: any) => ({
          id: n.id || `node_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          label: typeof n.label === 'string' ? n.label : '未命名节点',
          size: typeof n.size === 'number' ? n.size : 20,
          category: typeof n.category === 'string' ? n.category : 'default'
        })) : [],
        links: Array.isArray(knowledgeGraph.links) ? knowledgeGraph.links.map((l: any) => ({
          source: l.source || '',
          target: l.target || '',
          value: typeof l.value === 'number' ? l.value : 1
        })) : []
      } : { nodes: [], links: [] };
      
      // 检查用户是否已有学习轨迹
      const existingPath = await this.getLearningPath(userId);
      
      try {
        if (existingPath) {
          // 如果存在，更新现有记录
          log(`更新用户 ${userId} 的现有学习轨迹记录`);
          
          // 准备更新数据
          const updateData: any = {
            topics: safeTopics,
            distribution: safeDistribution,
            suggestions: safeSuggestions,
            knowledgeGraph: safeKnowledgeGraph,
            updatedAt: new Date(),
            version: existingPath.version + 1
          };
          
          // 设置过期时间（默认168小时/1周）
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + expiryHours);
          updateData.expiresAt = expiresAt;
          
          // 设置优化标志
          if (isOptimized !== undefined) updateData.isOptimized = isOptimized;
          
          // 处理历史记录
          if (progressHistory && Array.isArray(progressHistory)) {
            // 如果提供了新的历史记录，则替换旧记录
            updateData.progressHistory = progressHistory;
          } else if (existingPath.progressHistory) {
            // 如果没有提供新记录但有旧记录，保留旧记录并添加当前状态
            const currentProgressEntry = {
              date: new Date().toISOString().split('T')[0], // 当前日期，格式为YYYY-MM-DD
              topics: safeDistribution
            };
            
            // 获取现有历史记录，确保它是数组
            const existingHistory = Array.isArray(existingPath.progressHistory) 
              ? existingPath.progressHistory 
              : [];
              
            // 添加新的记录并保存
            updateData.progressHistory = [...existingHistory, currentProgressEntry];
          } else {
            // 如果没有历史记录，创建新的
            updateData.progressHistory = [{
              date: new Date().toISOString().split('T')[0],
              topics: safeDistribution
            }];
          }
          
          // 执行更新操作，使用预处理过的安全数据
          const [updatedPath] = await db.update(learningPaths)
            .set(updateData)
            .where(eq(learningPaths.userId, userId))
            .returning();
            
          log(`用户 ${userId} 的学习轨迹已更新，版本: ${updatedPath.version}`);
          return updatedPath;
        } else {
          // 如果不存在，创建新记录
          log(`为用户 ${userId} 创建首次学习轨迹记录`);
          
          // 准备创建数据，使用预处理过的安全数据
          const newData: any = {
            userId,
            topics: safeTopics,
            distribution: safeDistribution,
            suggestions: safeSuggestions,
            knowledgeGraph: safeKnowledgeGraph,
            version: 1,
            isOptimized: isOptimized || false
          };
          
          // 设置过期时间（默认168小时/1周）
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + expiryHours);
          newData.expiresAt = expiresAt;
          
          // 初始化历史记录
          if (progressHistory && Array.isArray(progressHistory)) {
            newData.progressHistory = progressHistory;
          } else {
            // 创建初始历史记录
            newData.progressHistory = [{
              date: new Date().toISOString().split('T')[0],
              topics: safeDistribution
            }];
          }
          
          // 创建记录
          const [newPath] = await db.insert(learningPaths)
            .values(newData)
            .returning();
            
          log(`为用户 ${userId} 创建了新的学习轨迹记录，ID: ${newPath.id}`);
          return newPath;
        }
      } catch (dbError: any) {
        // 处理特定的数据库错误
        log(`[storage-error] 数据库操作失败: ${dbError.message}`);
        console.error('[DB-ERROR] 详细错误:', dbError);
        
        // 检查是否为唯一约束错误（同一用户重复记录）
        if (dbError.code === '23505' || (dbError.message && dbError.message.includes('unique'))) {
          log(`[storage-error] 检测到唯一约束冲突，尝试删除现有记录后重新创建`);
          
          try {
            // 先删除可能冲突的记录
            await db.delete(learningPaths)
              .where(eq(learningPaths.userId, userId));
              
            log(`[storage-recovery] 成功删除冲突记录，正在重新创建`);
            
            // 重新创建记录
            const [recreatedPath] = await db.insert(learningPaths)
              .values({
                userId,
                topics: safeTopics,
                distribution: safeDistribution,
                suggestions: safeSuggestions,
                knowledgeGraph: safeKnowledgeGraph,
                version: 1,
                isOptimized: isOptimized || false,
                expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
                progressHistory: [{
                  date: new Date().toISOString().split('T')[0],
                  topics: safeDistribution
                }]
              })
              .returning();
              
            log(`[storage-recovery] 成功重新创建学习轨迹记录，ID: ${recreatedPath.id}`);
            return recreatedPath;
          } catch (recoveryError: any) {
            log(`[storage-recovery] 恢复操作失败: ${recoveryError.message}`);
            throw new Error(`学习轨迹恢复失败: ${recoveryError.message}`);
          }
        }
        
        // 重新抛出错误以便上层处理
        throw dbError;
      }
    } catch (error: any) {
      console.error('[DB-ERROR] 保存学习轨迹错误:', error);
      
      // 安全访问错误属性
      const errorMessage = error?.message || '未知错误';
      log(`[storage-error] 保存学习轨迹错误: ${errorMessage}`);
      
      // 检查错误类型，提供更详细的日志
      if (error?.code) {
        log(`[storage-error] 数据库错误代码: ${error.code}`);
      }
      
      // 重新抛出经过处理的错误对象，以避免undefined或非标准错误导致应用崩溃
      throw new Error(`保存学习轨迹失败: ${errorMessage}`);
    }
  }
  
  async getLearningPath(userId: number): Promise<LearningPath | undefined> {
    try {
      if (!userId || isNaN(userId)) {
        log(`获取学习轨迹失败: 无效的用户ID ${userId}`);
        return undefined;
      }
      
      // 获取未过期的学习轨迹
      const [path] = await db.select()
        .from(learningPaths)
        .where(
          and(
            eq(learningPaths.userId, userId),
            or(
              // 未设置过期时间
              isNull(learningPaths.expiresAt),
              // 或者未过期
              sql`${learningPaths.expiresAt} > NOW()`
            )
          )
        );
      
      if (path) {
        log(`找到用户 ${userId} 的有效学习轨迹，版本: ${path.version}`);
      } else {
        log(`未找到用户 ${userId} 的有效学习轨迹或缓存已过期`);
      }
        
      return path;
    } catch (error) {
      log(`获取学习轨迹错误: ${error}`);
      throw error;
    }
  }
  
  async updateLearningPathHistory(userId: number, newProgressEntry: any): Promise<LearningPath | undefined> {
    try {
      if (!userId || isNaN(userId)) {
        log(`更新学习轨迹历史失败: 无效的用户ID ${userId}`);
        throw new Error("Invalid user ID");
      }
      
      // 获取现有学习轨迹
      const existingPath = await this.getLearningPath(userId);
      if (!existingPath) {
        log(`更新学习轨迹历史失败: 用户 ${userId} 没有现有学习轨迹`);
        return undefined;
      }
      
      // 确保进度历史是数组
      const existingHistory = Array.isArray(existingPath.progressHistory) 
        ? existingPath.progressHistory 
        : [];
        
      // 添加新的历史记录
      const updatedHistory = [...existingHistory, newProgressEntry];
      
      // 设置新的过期时间
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 168); // 默认七天过期
      
      // 更新数据库记录
      const [updatedPath] = await db.update(learningPaths)
        .set({ 
          progressHistory: updatedHistory,
          updatedAt: new Date(),
          version: existingPath.version + 1,
          expiresAt: expiresAt
        })
        .where(eq(learningPaths.userId, userId))
        .returning();
        
      log(`用户 ${userId} 的学习轨迹历史已更新，历史记录数: ${updatedHistory.length}`);
      return updatedPath;
    } catch (error) {
      log(`更新学习轨迹历史错误: ${error}`);
      throw error;
    }
  }
  
  /**
   * 清除用户的学习轨迹数据
   * @param userId 用户ID
   */
  async clearLearningPath(userId: number): Promise<void> {
    try {
      if (!userId || isNaN(userId)) {
        log(`清除学习轨迹失败: 无效的用户ID ${userId}`);
        throw new Error("Invalid user ID");
      }
      
      await db.delete(learningPaths)
        .where(eq(learningPaths.userId, userId));
      
      log(`已清除用户 ${userId} 的学习轨迹数据`);
    } catch (error) {
      log(`清除学习轨迹数据时出错: ${error}`);
      throw error;
    }
  }

  // ========== 学生智能体相关方法实现 ==========

  // 学生智能体配置方法
  async createStudentAgentPreset(preset: InsertStudentAgentPreset): Promise<StudentAgentPreset> {
    try {
      if (!preset.name || !preset.subject || !preset.gradeLevel) {
        throw new Error("缺少必要的智能体配置字段");
      }

      const [newPreset] = await db.insert(studentAgentPresets)
        .values(preset)
        .returning();
      
      log(`创建新的学生智能体配置: ${newPreset.name}`);
      return newPreset;
    } catch (error) {
      log(`创建学生智能体配置错误: ${error}`);
      throw error;
    }
  }

  async updateStudentAgentPreset(presetId: number, updates: Partial<StudentAgentPreset>): Promise<StudentAgentPreset> {
    try {
      // 更新时间戳
      updates.updatedAt = new Date();
      
      const [updatedPreset] = await db.update(studentAgentPresets)
        .set(updates)
        .where(eq(studentAgentPresets.id, presetId))
        .returning();
      
      if (!updatedPreset) {
        throw new Error(`未找到ID为 ${presetId} 的智能体配置`);
      }
      
      log(`更新学生智能体配置成功: ${updatedPreset.name}`);
      return updatedPreset;
    } catch (error) {
      log(`更新学生智能体配置错误: ${error}`);
      throw error;
    }
  }

  async getStudentAgentPreset(presetId: number): Promise<StudentAgentPreset | undefined> {
    try {
      const [preset] = await db.select()
        .from(studentAgentPresets)
        .where(eq(studentAgentPresets.id, presetId));
      
      return preset;
    } catch (error) {
      log(`获取学生智能体配置错误: ${error}`);
      throw error;
    }
  }

  async getAllStudentAgentPresets(): Promise<StudentAgentPreset[]> {
    try {
      return await db.select()
        .from(studentAgentPresets)
        .orderBy(asc(studentAgentPresets.name));
    } catch (error) {
      log(`获取所有学生智能体配置错误: ${error}`);
      throw error;
    }
  }

  async deleteStudentAgentPreset(presetId: number): Promise<void> {
    try {
      // 使用事务确保数据一致性
      await db.transaction(async (tx) => {
        // 首先检查是否有使用此配置的会话
        const sessions = await tx.select()
          .from(studentAgentSessions)
          .where(eq(studentAgentSessions.presetId, presetId));
        
        if (sessions.length > 0) {
          // 将活跃会话标记为非活跃
          await tx.update(studentAgentSessions)
            .set({ isActive: false })
            .where(eq(studentAgentSessions.presetId, presetId));
          
          log(`将使用配置 ${presetId} 的 ${sessions.length} 个会话标记为非活跃`);
        }
        
        // 删除预设配置
        await tx.delete(studentAgentPresets)
          .where(eq(studentAgentPresets.id, presetId));
      });
      
      log(`删除学生智能体配置成功: ${presetId}`);
    } catch (error) {
      log(`删除学生智能体配置错误: ${error}`);
      throw error;
    }
  }

  // 学生智能体会话方法
  async createStudentAgentSession(
    userId: number, 
    presetId: number, 
    learningTopic: string,
    name?: string
  ): Promise<StudentAgentSession> {
    try {
      // 验证用户和预设配置
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }
      
      const preset = await this.getStudentAgentPreset(presetId);
      if (!preset) {
        throw new Error(`智能体配置不存在: ${presetId}`);
      }
      
      // 创建初始状态，包含KWLQ表格
      const initialState = {
        kwlq: {
          K: [""], // 已知内容
          W: [learningTopic], // 想学内容，初始化为主题
          L: [], // 已学内容
          Q: [] // 问题
        },
        lastUpdated: new Date().toISOString()
      };
      
      // 确定会话名称
      const sessionName = name || `${learningTopic} (${preset.name})`;
      
      // 创建新会话
      const [newSession] = await db.insert(studentAgentSessions)
        .values({
          userId,
          presetId,
          name: sessionName,
          learningTopic,
          currentState: initialState,
          motivationLevel: preset.motivationLevel === "high" ? 80 : preset.motivationLevel === "medium" ? 60 : 40,
          confusionLevel: 20, // 初始困惑度较低
          isActive: true
        })
        .returning();
      
      log(`创建新的学生智能体会话: ${newSession.name}, 用户: ${userId}, 预设: ${preset.name}`);
      return newSession;
    } catch (error) {
      log(`创建学生智能体会话错误: ${error}`);
      throw error;
    }
  }

  async getStudentAgentSession(sessionId: number): Promise<StudentAgentSession | undefined> {
    try {
      const [session] = await db.select()
        .from(studentAgentSessions)
        .where(eq(studentAgentSessions.id, sessionId));
      
      return session;
    } catch (error) {
      log(`获取学生智能体会话错误: ${error}`);
      throw error;
    }
  }

  async getStudentAgentSessionsByUser(userId: number): Promise<StudentAgentSession[]> {
    try {
      return await db.select()
        .from(studentAgentSessions)
        .where(eq(studentAgentSessions.userId, userId))
        .orderBy(desc(studentAgentSessions.lastInteractionAt));
    } catch (error) {
      log(`获取用户学生智能体会话错误: ${error}`);
      throw error;
    }
  }

  async updateStudentAgentSessionState(
    sessionId: number, 
    currentState: any, 
    motivationLevel?: number,
    confusionLevel?: number
  ): Promise<StudentAgentSession> {
    try {
      const updates: any = {
        currentState,
        lastInteractionAt: new Date()
      };
      
      if (motivationLevel !== undefined) {
        updates.motivationLevel = Math.max(0, Math.min(100, motivationLevel));
      }
      
      if (confusionLevel !== undefined) {
        updates.confusionLevel = Math.max(0, Math.min(100, confusionLevel));
      }
      
      const [updatedSession] = await db.update(studentAgentSessions)
        .set(updates)
        .where(eq(studentAgentSessions.id, sessionId))
        .returning();
      
      if (!updatedSession) {
        throw new Error(`未找到会话: ${sessionId}`);
      }
      
      log(`更新学生智能体会话状态: ${sessionId}, 动机: ${updates.motivationLevel}, 困惑: ${updates.confusionLevel}`);
      return updatedSession;
    } catch (error) {
      log(`更新学生智能体会话状态错误: ${error}`);
      throw error;
    }
  }

  async completeStudentAgentSession(sessionId: number): Promise<void> {
    try {
      // 将会话标记为非活跃，计算完成的目标等
      const session = await this.getStudentAgentSession(sessionId);
      if (!session) {
        throw new Error(`未找到会话: ${sessionId}`);
      }
      
      // 定义KWLQ数据类型
      type KWLQData = {
        K: string[];
        W: string[];
        L: string[];
        Q: string[];
      };
      
      // 统计KWLQ状态
      let completedObjectives: Array<{content: string; completedAt: string}> = [];
      
      if (session.currentState) {
        // 安全地获取和处理KWLQ数据
        const currentState = session.currentState as {kwlq?: any};
        
        if (currentState.kwlq) {
          // 确保KWLQ结构的每个字段都存在且为数组
          const kwlq: KWLQData = {
            K: Array.isArray(currentState.kwlq.K) ? currentState.kwlq.K : [],
            W: Array.isArray(currentState.kwlq.W) ? currentState.kwlq.W : [],
            L: Array.isArray(currentState.kwlq.L) ? currentState.kwlq.L : [],
            Q: Array.isArray(currentState.kwlq.Q) ? currentState.kwlq.Q : []
          };
          
          // 将已学会的项目作为完成的目标
          completedObjectives = kwlq.L.map(item => ({
            content: item,
            completedAt: new Date().toISOString()
          }));
        }
      }
      
      // 更新会话
      await db.update(studentAgentSessions)
        .set({
          isActive: false,
          completedObjectives,
          lastInteractionAt: new Date()
        })
        .where(eq(studentAgentSessions.id, sessionId));
      
      log(`标记学生智能体会话为已完成: ${sessionId}, 完成目标数: ${completedObjectives.length}`);
    } catch (error) {
      log(`完成学生智能体会话错误: ${error}`);
      throw error;
    }
  }

  // 学生智能体消息方法
  async createStudentAgentMessage(
    sessionId: number, 
    content: string, 
    role: "student" | "tutor" | "system",
    stateSnapshot?: any,
    kwlqUpdateType?: "K" | "W" | "L" | "Q" | "none",
    kwlqUpdateContent?: string
  ): Promise<StudentAgentMessage> {
    try {
      // 获取会话以确认存在
      const session = await this.getStudentAgentSession(sessionId);
      if (!session) {
        throw new Error(`未找到会话: ${sessionId}`);
      }
      
      // 创建消息
      const [newMessage] = await db.insert(studentAgentMessages)
        .values({
          sessionId,
          content,
          role,
          stateSnapshot: stateSnapshot || session.currentState,
          kwlqUpdateType: kwlqUpdateType || "none",
          kwlqUpdateContent
        })
        .returning();
      
      // 更新会话的最后交互时间
      await db.update(studentAgentSessions)
        .set({ lastInteractionAt: new Date() })
        .where(eq(studentAgentSessions.id, sessionId));
      
      log(`创建学生智能体消息: 会话ID=${sessionId}, 角色=${role}, KWLQ更新=${kwlqUpdateType || 'none'}`);
      return newMessage;
    } catch (error) {
      log(`创建学生智能体消息错误: ${error}`);
      throw error;
    }
  }

  async getStudentAgentSessionMessages(sessionId: number): Promise<StudentAgentMessage[]> {
    try {
      return await db.select()
        .from(studentAgentMessages)
        .where(eq(studentAgentMessages.sessionId, sessionId))
        .orderBy(asc(studentAgentMessages.timestamp));
    } catch (error) {
      log(`获取学生智能体会话消息错误: ${error}`);
      throw error;
    }
  }

  // 学生智能体评估方法
  async createStudentAgentEvaluation(
    sessionId: number,
    evaluatorId: number,
    realismScore: number,
    learningTrajectoryScore: number,
    kwlqCompletionRate: number,
    languageDiversityScore?: number,
    comments?: string
  ): Promise<StudentAgentEvaluation> {
    try {
      // 验证评分范围
      const checkScore = (score: number, name: string, min = 1, max = 10) => {
        if (score < min || score > max) {
          throw new Error(`${name}分数必须在 ${min}-${max} 之间`);
        }
      };
      
      checkScore(realismScore, "真实感");
      checkScore(learningTrajectoryScore, "学习轨迹");
      checkScore(kwlqCompletionRate, "KWLQ完成率", 0, 100);
      
      if (languageDiversityScore !== undefined) {
        checkScore(languageDiversityScore, "语言多样性");
      }
      
      // 创建评估记录
      const [evaluation] = await db.insert(studentAgentEvaluations)
        .values({
          sessionId,
          evaluatorId,
          realismScore,
          learningTrajectoryScore,
          kwlqCompletionRate,
          languageDiversityScore,
          comments
        })
        .returning();
      
      log(`创建学生智能体评估: 会话ID=${sessionId}, 评估者=${evaluatorId}, 真实感=${realismScore}/10`);
      return evaluation;
    } catch (error) {
      log(`创建学生智能体评估错误: ${error}`);
      throw error;
    }
  }

  async getStudentAgentEvaluationsBySession(sessionId: number): Promise<StudentAgentEvaluation[]> {
    try {
      return await db.select()
        .from(studentAgentEvaluations)
        .where(eq(studentAgentEvaluations.sessionId, sessionId))
        .orderBy(desc(studentAgentEvaluations.evaluatedAt));
    } catch (error) {
      log(`获取学生智能体评估错误: ${error}`);
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

  // 知识图谱缓存方法
  async saveKnowledgeGraphCache(
    userId: number, 
    nodes: any[], 
    links: any[], 
    expiryHours: number = 24
  ): Promise<KnowledgeGraphCache> {
    try {
      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);
      
      // 先检查该用户是否已有缓存
      const existingCache = await this.getKnowledgeGraphCache(userId);
      
      if (existingCache) {
        // 如果存在，则更新现有记录
        const [updated] = await db.update(knowledgeGraphCache)
          .set({
            nodes: nodes as any,
            links: links as any,
            version: existingCache.version + 1,
            updatedAt: new Date(),
            expiresAt
          })
          .where(eq(knowledgeGraphCache.userId, userId))
          .returning();
        
        log(`为用户 ${userId} 更新知识图谱缓存，版本 ${updated.version}`);
        return updated;
      } else {
        // 如果不存在，则创建新记录
        const [newCache] = await db.insert(knowledgeGraphCache)
          .values({
            userId,
            nodes: nodes as any,
            links: links as any,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt
          })
          .returning();
        
        log(`为用户 ${userId} 创建知识图谱缓存`);
        return newCache;
      }
    } catch (error) {
      log(`保存知识图谱缓存错误: ${error}`);
      throw error;
    }
  }
  
  async getKnowledgeGraphCache(userId: number): Promise<KnowledgeGraphCache | undefined> {
    try {
      const [cache] = await db.select()
        .from(knowledgeGraphCache)
        .where(
          and(
            eq(knowledgeGraphCache.userId, userId),
            sql`${knowledgeGraphCache.expiresAt} > NOW() OR ${knowledgeGraphCache.expiresAt} IS NULL`
          )
        );
      
      if (cache) {
        log(`为用户 ${userId} 找到有效的知识图谱缓存，版本 ${cache.version}`);
      }
      
      return cache;
    } catch (error) {
      log(`获取知识图谱缓存错误: ${error}`);
      throw error;
    }
  }
  
  async clearKnowledgeGraphCache(userId: number): Promise<void> {
    try {
      await db.delete(knowledgeGraphCache)
        .where(eq(knowledgeGraphCache.userId, userId));
      
      log(`已清除用户 ${userId} 的知识图谱缓存`);
    } catch (error) {
      log(`清除知识图谱缓存错误: ${error}`);
      throw error;
    }
  }
  
  // 聚类结果缓存方法
  async saveClusterResultCache(
    userId: number,
    clusterData: any,
    clusterCount: number,
    vectorCount: number,
    expiryHours: number = 168 // 默认一周
  ): Promise<ClusterResultCache> {
    try {
      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);
      
      // 确保数据可以被正确序列化
      let safeClusterData: any;
      try {
        // 处理数组格式转为对象格式
        if (Array.isArray(clusterData)) {
          log(`[storage] 检测到数组格式的聚类数据，转换为对象格式`);
          const tempObj: any = {};
          clusterData.forEach((item, index) => {
            tempObj[`cluster_${index}`] = item;
          });
          clusterData = tempObj;
        }
        
        // 检查是否包含非对象结构，如版本号、时间戳
        const nonObjectEntries = Object.entries(clusterData).filter(([_, value]) => 
          typeof value !== 'object' || value === null
        );
        
        if (nonObjectEntries.length > 0) {
          log(`[storage] 检测到${nonObjectEntries.length}个非对象字段，修复数据格式`);
          // 修复非对象字段
          nonObjectEntries.forEach(([key, value]) => {
            clusterData[key] = {
              topic: `${key}: ${value}`,
              memory_ids: [],
              keywords: [key],
              summary: `${value}`
            };
          });
        }
        
        // 验证数据可以被正确序列化
        const serialized = JSON.stringify(clusterData);
        safeClusterData = JSON.parse(serialized);
        
        // 记录明确的数据验证日志
        log(`[storage] 聚类数据序列化验证通过，数据大小: ${serialized.length} 字节`);
        
        // 检查关键字段是否保留
        const hasTopics = Object.values(safeClusterData).some((cluster: any) => 
          cluster && typeof cluster === 'object' && cluster.topic && cluster.topic.length > 0
        );
        
        if (!hasTopics) {
          log(`[storage] 警告：序列化后的聚类数据缺少topic字段，检查数据结构`, "warn");
          
          // 手动确保每个聚类有topic字段
          for (const [clusterId, cluster] of Object.entries(safeClusterData)) {
            if (!cluster || typeof cluster !== 'object') {
              safeClusterData[clusterId] = {
                topic: `聚类 ${clusterId}`,
                memory_ids: [],
                keywords: [],
                summary: ''
              };
              log(`[storage] 修复聚类 ${clusterId}：替换为标准对象结构`);
              continue;
            }
            
            const c = cluster as any;
            if (!c.topic && c.label) {
              log(`[storage] 修复聚类 ${clusterId} 数据：从label复制到topic`);
              c.topic = c.label;
            } else if (!c.topic && c.keywords && Array.isArray(c.keywords) && c.keywords.length > 0) {
              c.topic = c.keywords.slice(0, 2).join(' 与 ');
              log(`[storage] 修复聚类 ${clusterId} 数据：从keywords创建topic "${c.topic}"`);
            } else if (!c.topic) {
              c.topic = `聚类 ${clusterId}`;
              log(`[storage] 修复聚类 ${clusterId} 数据：设置默认topic "${c.topic}"`);
            }
          }
        }
      } catch (serializeError) {
        log(`[storage] 聚类数据序列化失败: ${serializeError}，使用简化版本`, "error");
        
        // 创建一个安全的简化版本
        safeClusterData = {};
        
        // 创建标准化的主题对象
        for (let i = 0; i < Math.max(1, clusterCount); i++) {
          safeClusterData[`cluster_${i}`] = {
            topic: `聚类 ${i+1}`,
            memory_ids: [],
            keywords: [],
            summary: ''
          };
        }
        
        // 添加元数据
        safeClusterData.metadata = {
          generated_at: new Date().toISOString(),
          cluster_count: clusterCount,
          source: "simplified_fallback"
        };
      }
      
      // 先检查该用户是否已有缓存
      const existingCache = await this.getClusterResultCache(userId);
      
      if (existingCache) {
        // 如果存在，则更新现有记录
        try {
          const [updated] = await db.update(clusterResultCache)
            .set({
              clusterData: safeClusterData as any,
              clusterCount,
              vectorCount,
              version: existingCache.version + 1,
              updatedAt: new Date(),
              expiresAt
            })
            .where(eq(clusterResultCache.userId, userId))
            .returning();
          
          log(`[storage] 为用户 ${userId} 更新聚类结果缓存，版本 ${updated.version}，包含 ${clusterCount} 个聚类，${vectorCount} 个向量`);
          return updated;
        } catch (updateError) {
          log(`[storage] 更新聚类缓存失败: ${updateError}，尝试删除后重建`, "error");
          // 如果更新失败，尝试删除后重建
          await db.delete(clusterResultCache).where(eq(clusterResultCache.userId, userId));
          throw new Error("更新失败，已删除现有缓存");  // 抛出异常触发重建
        }
      } else {
        // 如果不存在，则创建新记录
        const [newCache] = await db.insert(clusterResultCache)
          .values({
            userId,
            clusterData: safeClusterData as any,
            clusterCount,
            vectorCount,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt
          })
          .returning();
        
        log(`[storage] 为用户 ${userId} 创建聚类结果缓存，包含 ${clusterCount} 个聚类，${vectorCount} 个向量`);
        return newCache;
      }
    } catch (error) {
      log(`[storage] 保存聚类结果缓存错误: ${error}`, "error");
      throw error;
    }
  }
  
  async getClusterResultCache(userId: number): Promise<ClusterResultCache | undefined> {
    try {
      const [cache] = await db.select()
        .from(clusterResultCache)
        .where(
          and(
            eq(clusterResultCache.userId, userId),
            sql`${clusterResultCache.expiresAt} > NOW() OR ${clusterResultCache.expiresAt} IS NULL`
          )
        );
      
      if (cache) {
        log(`为用户 ${userId} 找到有效的聚类结果缓存，版本 ${cache.version}，包含 ${cache.clusterCount} 个聚类`);
      }
      
      return cache;
    } catch (error) {
      log(`获取聚类结果缓存错误: ${error}`);
      throw error;
    }
  }
  
  async clearClusterResultCache(userId: number): Promise<void> {
    try {
      await db.delete(clusterResultCache)
        .where(eq(clusterResultCache.userId, userId));
      
      log(`已清除用户 ${userId} 的聚类结果缓存`);
    } catch (error) {
      log(`清除聚类结果缓存错误: ${error}`);
      throw error;
    }
  }
  
  async clearTopicLabels(userId: number): Promise<void> {
    try {
      log(`清除用户 ${userId} 的主题标签`);
      
      // 获取该用户的所有记忆ID
      const userMemories = await this.getMemoriesByUserId(userId);
      if (!userMemories || userMemories.length === 0) {
        log(`用户 ${userId} 没有记忆记录，无需清除主题标签`);
        return;
      }
      
      // 提取记忆ID
      const memoryIds = userMemories.map(memory => memory.id);
      
      // 从memoryKeywords表中删除所有与这些记忆相关的主题标签
      await db.delete(memoryKeywords)
        .where(inArray(memoryKeywords.memoryId, memoryIds));
      
      log(`已成功清除用户 ${userId} 的主题标签`);
    } catch (error) {
      log(`清除用户 ${userId} 的主题标签时出错: ${error}`);
      throw error;
    }
  }
}

// Export a single instance of the storage
export const storage = new DatabaseStorage();