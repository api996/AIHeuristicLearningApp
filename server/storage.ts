import { users, type User, type InsertUser, chats, messages, type Chat, type Message } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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
      query.where(eq(chats.userId, userId));
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
    const chat = await this.getChatById(chatId, userId, isAdmin);
    if (!chat) return [];

    return await db.select()
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }
}

export const storage = new DatabaseStorage();