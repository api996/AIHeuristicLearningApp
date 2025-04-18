-- 记忆ID类型修复迁移脚本
-- 解决ID列类型与实际存储值不匹配的问题

-- 1. 创建临时表存储旧数据
BEGIN;

-- 创建记忆嵌入临时表
CREATE TABLE memory_embeddings_temp (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL, -- 改为TEXT类型
  vector_data JSONB NOT NULL
);

-- 复制现有数据
INSERT INTO memory_embeddings_temp (id, memory_id, vector_data)
SELECT id, memory_id::TEXT, vector_data FROM memory_embeddings;

-- 删除旧表
DROP TABLE memory_embeddings CASCADE;

-- 创建新表
CREATE TABLE memory_embeddings (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL, -- 使用TEXT存储记忆ID
  vector_data JSONB NOT NULL
);

-- 创建索引
CREATE INDEX memory_embeddings_memory_id_idx ON memory_embeddings (memory_id);

-- 复制回数据
INSERT INTO memory_embeddings (id, memory_id, vector_data)
SELECT id, memory_id, vector_data FROM memory_embeddings_temp;

-- 删除临时表
DROP TABLE memory_embeddings_temp;

-- 修改记忆关键词表
CREATE TABLE memory_keywords_temp (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL, -- 改为TEXT类型
  keyword TEXT NOT NULL
);

-- 复制现有数据
INSERT INTO memory_keywords_temp (id, memory_id, keyword)
SELECT id, memory_id::TEXT, keyword FROM memory_keywords;

-- 删除旧表
DROP TABLE memory_keywords CASCADE;

-- 创建新表
CREATE TABLE memory_keywords (
  id SERIAL PRIMARY KEY,
  memory_id TEXT NOT NULL, -- 使用TEXT存储记忆ID
  keyword TEXT NOT NULL
);

-- 创建索引
CREATE INDEX memory_keywords_memory_id_idx ON memory_keywords (memory_id);

-- 复制回数据
INSERT INTO memory_keywords (id, memory_id, keyword)
SELECT id, memory_id, keyword FROM memory_keywords_temp;

-- 删除临时表
DROP TABLE memory_keywords_temp;

COMMIT;