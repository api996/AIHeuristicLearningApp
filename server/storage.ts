
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, chats, messages, type User, type InsertUser, type Chat, type Message } from "@shared/schema";

// 定义存储接口
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Chat methods
  createChat(userId: number, title: string, model: string): Promise<Chat>;
  getUserChats(userId: number): Promise<Chat[]>;
  deleteChat(chatId: number): Promise<void>;

  // Message methods
  createMessage(chatId: number, content: string, role: string): Promise<Message>;
  getChatMessages(chatId: number): Promise<Message[]>;
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

  // Chat methods
  async createChat(userId: number, title: string, model: string): Promise<Chat> {
    const [chat] = await db.insert(chats)
      .values({ userId, title, model })
      .returning();
    return chat;
  }

  async getUserChats(userId: number): Promise<Chat[]> {
    return await db.select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(chats.createdAt);
  }

  async deleteChat(chatId: number): Promise<void> {
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

  async getChatMessages(chatId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }
}

export const storage = new DatabaseStorage();
