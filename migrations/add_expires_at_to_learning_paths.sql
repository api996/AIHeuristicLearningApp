-- 添加 expires_at 字段到 learning_paths 表
ALTER TABLE learning_paths
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 更新已有记录，设置7天有效期
UPDATE learning_paths
SET expires_at = NOW() + INTERVAL '7 days'
WHERE expires_at IS NULL;

-- 更新知识图谱字段
ALTER TABLE learning_paths
ADD COLUMN IF NOT EXISTS knowledge_graph JSONB;

-- 日志
DO $$
BEGIN
    RAISE NOTICE '已成功添加 expires_at 字段到 learning_paths 表并设置默认过期时间';
END $$;