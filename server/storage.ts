import { users, type User, type InsertUser, chats, messages, type Chat, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, ne, and, asc, desc } from "drizzle-orm";
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
  
  async updateMessage(messageId: number, content: string, isUserOwned: boolean): Promise<Message> {
    try {
      if (!messageId || isNaN(messageId)) {
        log(`Invalid message ID for update: ${messageId}`);
        throw new Error("Invalid message ID");
      }
      
      if (!content || typeof content !== 'string') {
        log(`Invalid content format: ${content}`);
        throw new Error("Invalid content format");
      }
      
      // 安全检查：只允许更新用户自己的消息
      if (isUserOwned) {
        const [message] = await db.select()
          .from(messages)
          .where(and(
            eq(messages.id, messageId),
            eq(messages.role, "user")
          ));
          
        if (!message) {
          throw new Error("Message not found or not owned by user");
        }
      }
      
      // 更新消息内容并标记为已编辑
      const [updatedMessage] = await db.update(messages)
        .set({ 
          content: content,
          isEdited: true
        })
        .where(eq(messages.id, messageId))
        .returning();
        
      log(`Message updated for message ${messageId}`);
      return updatedMessage;
    } catch (error) {
      log(`Error updating message: ${error}`);
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
}

// Export a single instance of the storage
export const storage = new DatabaseStorage();