-- 创建临时表存储文件系统中存在但数据库中不存在的记忆ID
CREATE TEMP TABLE missing_memory_ids (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT,
    type TEXT DEFAULT 'chat'
);

-- 插入从文件系统中识别出但在数据库中缺失的ID
INSERT INTO missing_memory_ids (id, user_id) VALUES
('20250413_example', 1),
('20250416003049824267', 7),
('20250416003049831774', 7),
('20250416073940185627', 7),
('20250416073940260927', 7),
('20250416073940307252', 7),
('20250416073940357071', 7),
('20250416073940406428', 7),
('20250416073940463294', 7),
('20250416074022318532', 7),
('20250416074022365307', 7),
('20250416074022412084', 7),
('20250416074022454904', 7),
('20250416074022499780', 7),
('20250416074204342772', 7),
('20250416074204387189', 7),
('20250419051507045911', 7),
('20250419051507133641', 7),
('20250419051507221827', 7),
('20250419051606642458', 7),
('20250419051606699302', 7),
('20250419051606757054', 7),
('20250419051606814835', 7),
('20250419051607066639', 7),
('20250419051607122027', 7);

-- 更新临时表的内容字段（从示例文件提取的内容例子）
UPDATE missing_memory_ids
SET content = CASE 
    WHEN id = '20250413_example' THEN '示例记忆内容'
    WHEN id = '20250416003049824267' THEN '我只是想知道现在网络搜索是否正常的'
    ELSE '从记忆文件导入的内容'
    END,
    type = 'chat';

-- 将缺失的记忆导入到数据库中
INSERT INTO memories (id, user_id, content, type, summary, created_at)
SELECT 
    m.id, 
    m.user_id, 
    m.content, 
    m.type,
    '从文件系统恢复的记忆 - ' || substring(m.id, 1, 10), -- 简单的摘要
    TO_TIMESTAMP(
        CASE 
            WHEN m.id = '20250413_example' THEN '20250413000000'
            ELSE substring(m.id, 1, 14)
        END, 
        'YYYYMMDDHH24MISS'
    ) AS created_at
FROM missing_memory_ids m
WHERE NOT EXISTS (SELECT 1 FROM memories WHERE id = m.id);

-- 验证导入结果
SELECT COUNT(*) AS imported_memories FROM memories
WHERE summary LIKE '从文件系统恢复的记忆%';