import { users, type User, type InsertUser, chats, messages, type Chat, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, and, asc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;

  // Chat methods
  createChat(userId: number, title: string, model: string): Promise<Chat>;
  getUserChats(userId: number, isAdmin: boolean): Promise<Chat[]>;
  deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void>;
  getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined>;

  // Message methods
  createMessage(chatId: number, content: string, role: string): Promise<Message>;
  getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId));
  }

  // Chat methods
  async createChat(userId: number, title: string, model: string): Promise<Chat> {
    const [chat] = await db.insert(chats)
      .values({ userId, title, model })
      .returning();
    return chat;
  }

  async getUserChats(userId: number, isAdmin: boolean): Promise<Chat[]> {
    if (isAdmin) {
      // Admin can see all chats with user information
      return await db.select({
        id: chats.id,
        title: chats.title,
        model: chats.model,
        createdAt: chats.createdAt,
        userId: chats.userId,
        username: users.username,
      })
      .from(chats)
      .leftJoin(users, eq(chats.userId, users.id))
      .orderBy(chats.createdAt);
    } else {
      // Regular users can only see their own chats
      return await db.select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(chats.createdAt);
    }
  }

  async getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined> {
    const query = db.select()
      .from(chats)
      .where(eq(chats.id, chatId));

    if (!isAdmin) {
      // Regular users can only access their own chats
      query.where(and(eq(chats.userId, userId)));
    }

    const [chat] = await query;
    return chat;
  }

  async deleteChat(chatId: number, userId: number, isAdmin: boolean): Promise<void> {
    const chat = await this.getChatById(chatId, userId, isAdmin);
    if (!chat) return;

    // First delete all messages in the chat
    await db.delete(messages).where(eq(messages.chatId, chatId));
    // Then delete the chat itself
    await db.delete(chats).where(eq(chats.id, chatId));
  }

  // Message methods
  async createMessage(chatId: number, content: string, role: string): Promise<Message> {
    const [message] = await db.insert(messages)
      .values({ chatId, content, role })
      .returning();
    return message;
  }

  async getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]> {
    // First verify if the user has access to this chat
    const chat = await this.getChatById(chatId, userId, isAdmin);
    if (!chat) return []; // Chat not found or user doesn't have access

    // Only return messages if the user has access to the chat
    if (!isAdmin && chat.userId !== userId) return [];

    // Get messages for a specific chat
    const result = await db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt));

    return result;
  }
}

export const storage = new DatabaseStorage();
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import { log } from "./vite";

class Storage {
  // 用户相关方法
  async getUserByUsername(username: string) {
    try {
      const users = await db.select().from(schema.users).where(eq(schema.users.username, username));
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      log(`Error getting user by username: ${error}`);
      throw error;
    }
  }

  async getUser(userId: number) {
    try {
      const users = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      log(`Error getting user: ${error}`);
      throw error;
    }
  }

  async createUser({ username, password, role = "user" }: { username: string; password: string; role?: string }) {
    try {
      const result = await db.insert(schema.users).values({
        username,
        password,
        role: role as any,
      }).returning();
      return result[0];
    } catch (error) {
      log(`Error creating user: ${error}`);
      throw error;
    }
  }

  async updateUserPassword(userId: number, newPassword: string) {
    try {
      await db.update(schema.users)
        .set({ password: newPassword })
        .where(eq(schema.users.id, userId));
      return true;
    } catch (error) {
      log(`Error updating user password: ${error}`);
      throw error;
    }
  }

  // 聊天相关方法
  async getUserChats(userId: number, isAdmin: boolean) {
    try {
      if (isAdmin) {
        // 管理员可以看到所有聊天
        const result = await db.query.chats.findMany({
          with: {
            user: {
              columns: {
                username: true,
              },
            },
          },
          orderBy: (chats, { desc }) => [desc(chats.createdAt)],
        });
        
        // 处理结果以包含用户名
        return result.map(chat => ({
          ...chat,
          username: chat.user?.username,
        }));
      } else {
        // 普通用户只能看到自己的聊天
        return await db.select().from(schema.chats)
          .where(eq(schema.chats.userId, userId))
          .orderBy(schema.chats.createdAt, "desc");
      }
    } catch (error) {
      log(`Error getting user chats: ${error}`);
      throw error;
    }
  }

  async getChatById(chatId: number, userId: number, isAdmin: boolean) {
    try {
      if (isAdmin) {
        // 管理员可以访问任何聊天
        const chats = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
        return chats.length > 0 ? chats[0] : null;
      } else {
        // 普通用户只能访问自己的聊天
        const chats = await db.select().from(schema.chats)
          .where(and(
            eq(schema.chats.id, chatId),
            eq(schema.chats.userId, userId)
          ));
        return chats.length > 0 ? chats[0] : null;
      }
    } catch (error) {
      log(`Error getting chat by ID: ${error}`);
      throw error;
    }
  }

  async createChat(userId: number, title: string, model: string) {
    try {
      const result = await db.insert(schema.chats).values({
        userId,
        title,
        model,
      }).returning();
      return result[0];
    } catch (error) {
      log(`Error creating chat: ${error}`);
      throw error;
    }
  }

  async deleteChat(chatId: number, userId: number, isAdmin: boolean) {
    try {
      // 首先检查权限
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        throw new Error("Chat not found or access denied");
      }
      
      // 先删除相关消息
      await db.delete(schema.messages).where(eq(schema.messages.chatId, chatId));
      
      // 然后删除聊天记录
      await db.delete(schema.chats).where(eq(schema.chats.id, chatId));
      return true;
    } catch (error) {
      log(`Error deleting chat: ${error}`);
      throw error;
    }
  }

  // 消息相关方法
  async getChatMessages(chatId: number, userId: number, isAdmin: boolean) {
    try {
      // 首先验证用户有权限访问这个聊天
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) {
        throw new Error("Chat not found or access denied");
      }
      
      // 获取消息
      return await db.select().from(schema.messages)
        .where(eq(schema.messages.chatId, chatId))
        .orderBy(schema.messages.createdAt, "asc");
    } catch (error) {
      log(`Error getting chat messages: ${error}`);
      throw error;
    }
  }

  async createMessage(chatId: number, content: string, role: string) {
    try {
      const result = await db.insert(schema.messages).values({
        chatId,
        content,
        role,
      }).returning();
      return result[0];
    } catch (error) {
      log(`Error creating message: ${error}`);
      throw error;
    }
  }
}

export const storage = new Storage();
