
import { users, type User, type InsertUser, chats, messages, type Chat, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc } from "drizzle-orm";
import { log } from "./vite";

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
      const [user] = await db.insert(users).values(insertUser).returning();
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
        // Admin can see all chats with usernames
        return await db.select({
            id: chats.id,
            userId: chats.userId,
            title: chats.title,
            model: chats.model,
            createdAt: chats.createdAt,
            username: users.username
          })
          .from(chats)
          .leftJoin(users, eq(chats.userId, users.id))
          .orderBy(desc(chats.createdAt));
      } else {
        // Regular users can only see their own chats
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

  async getChatById(chatId: number, userId: number, isAdmin: boolean): Promise<Chat | undefined> {
    try {
      if (isAdmin) {
        // Admin can access any chat
        const [chat] = await db.select()
          .from(chats)
          .where(eq(chats.id, chatId));
        return chat;
      } else {
        // Regular users can only access their own chats
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
      await db.update(chats)
        .set({ title })
        .where(eq(chats.id, chatId));
    } catch (error) {
      log(`Error updating chat title: ${error}`);
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

  // Message methods
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

  async getChatMessages(chatId: number, userId: number, isAdmin: boolean): Promise<Message[]> {
    try {
      // First verify if the user has access to this chat
      const chat = await this.getChatById(chatId, userId, isAdmin);
      if (!chat) return []; // Chat not found or user doesn't have access

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
}

// Export a single instance of the storage
export const storage = new DatabaseStorage();
