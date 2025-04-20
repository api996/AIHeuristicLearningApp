import { pgTable, foreignKey, serial, integer, text, timestamp, json, boolean, unique, varchar } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const conversationAnalytics = pgTable("conversation_analytics", {
	id: serial().primaryKey().notNull(),
	chatId: integer("chat_id").notNull(),
	currentPhase: text("current_phase").notNull(),
	summary: text().notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "conversation_analytics_chat_id_chats_id_fk"
		}).onDelete("cascade"),
]);

export const memories = pgTable("memories", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	content: text().notNull(),
	type: text().default('chat').notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
	summary: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "memories_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const chats = pgTable("chats", {
	id: serial().primaryKey().notNull(),
	userId: serial("user_id").notNull(),
	title: text().notNull(),
	model: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chats_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const searchResults = pgTable("search_results", {
	id: serial().primaryKey().notNull(),
	query: text().notNull(),
	results: json().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
});

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	chatId: serial("chat_id").notNull(),
	content: text().notNull(),
	role: text().notNull(),
	model: text(),
	feedback: text(),
	isEdited: boolean("is_edited").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "messages_chat_id_chats_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	role: text().default('user').notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const promptTemplates = pgTable("prompt_templates", {
	id: serial().primaryKey().notNull(),
	modelId: text("model_id").notNull(),
	promptTemplate: text("prompt_template").notNull(),
	baseTemplate: text("base_template"),
	kTemplate: text("k_template"),
	wTemplate: text("w_template"),
	lTemplate: text("l_template"),
	qTemplate: text("q_template"),
	styleTemplate: text("style_template"),
	policyTemplate: text("policy_template"),
	sensitiveWords: text("sensitive_words"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	createdBy: integer("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "prompt_templates_created_by_users_id_fk"
		}).onDelete("set null"),
	unique("prompt_templates_model_id_unique").on(table.modelId),
]);

export const userSettings = pgTable("user_settings", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	backgroundFile: text("background_file"),
	theme: text().default('light'),
	fontSize: text("font_size").default('medium'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_settings_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_settings_user_id_unique").on(table.userId),
]);

export const userFiles = pgTable("user_files", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	fileId: text("file_id").notNull(),
	originalName: text("original_name").notNull(),
	filePath: text("file_path").notNull(),
	fileType: text("file_type").default('attachment').notNull(),
	publicUrl: text("public_url").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	storageType: text("storage_type").default('file-system').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_files_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_files_file_id_unique").on(table.fileId),
]);

export const memoryEmbeddings = pgTable("memory_embeddings", {
	id: serial().primaryKey().notNull(),
	memoryId: text("memory_id").notNull(),
	vectorData: json("vector_data").notNull(),
}, (table) => [
	unique("memory_embeddings_memory_id_unique").on(table.memoryId),
]);

export const systemConfig = pgTable("system_config", {
	id: serial().primaryKey().notNull(),
	key: text().notNull(),
	value: text().notNull(),
	description: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	updatedBy: integer("updated_by"),
}, (table) => [
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "system_config_updated_by_users_id_fk"
		}).onDelete("set null"),
	unique("system_config_key_unique").on(table.key),
]);

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
});

export const memoriesNew = pgTable("memories_new", {
	id: text().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	content: text().notNull(),
	type: text().default('chat').notNull(),
	timestamp: timestamp({ mode: 'string' }).defaultNow(),
	summary: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "memories_new_user_id_fkey"
		}),
]);

export const memoryKeywords = pgTable("memory_keywords", {
	id: serial().primaryKey().notNull(),
	memoryId: text("memory_id").notNull(),
	keyword: text().notNull(),
});

export const memoriesBackup = pgTable("memories_backup", {
	id: integer(),
	userId: integer("user_id"),
	content: text(),
	type: text(),
	timestamp: timestamp({ mode: 'string' }),
	summary: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
});
