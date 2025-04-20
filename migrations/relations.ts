import { relations } from "drizzle-orm/relations";
import { chats, conversationAnalytics, users, memories, messages, promptTemplates, userSettings, userFiles, systemConfig, memoriesNew } from "./schema";

export const conversationAnalyticsRelations = relations(conversationAnalytics, ({one}) => ({
	chat: one(chats, {
		fields: [conversationAnalytics.chatId],
		references: [chats.id]
	}),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	conversationAnalytics: many(conversationAnalytics),
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	}),
	messages: many(messages),
}));

export const memoriesRelations = relations(memories, ({one}) => ({
	user: one(users, {
		fields: [memories.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	memories: many(memories),
	chats: many(chats),
	promptTemplates: many(promptTemplates),
	userSettings: many(userSettings),
	userFiles: many(userFiles),
	systemConfigs: many(systemConfig),
	memoriesNews: many(memoriesNew),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id]
	}),
}));

export const promptTemplatesRelations = relations(promptTemplates, ({one}) => ({
	user: one(users, {
		fields: [promptTemplates.createdBy],
		references: [users.id]
	}),
}));

export const userSettingsRelations = relations(userSettings, ({one}) => ({
	user: one(users, {
		fields: [userSettings.userId],
		references: [users.id]
	}),
}));

export const userFilesRelations = relations(userFiles, ({one}) => ({
	user: one(users, {
		fields: [userFiles.userId],
		references: [users.id]
	}),
}));

export const systemConfigRelations = relations(systemConfig, ({one}) => ({
	user: one(users, {
		fields: [systemConfig.updatedBy],
		references: [users.id]
	}),
}));

export const memoriesNewRelations = relations(memoriesNew, ({one}) => ({
	user: one(users, {
		fields: [memoriesNew.userId],
		references: [users.id]
	}),
}));