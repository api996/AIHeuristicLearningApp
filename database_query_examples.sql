-- 数据库查询示例
-- 这些查询可用于分析和调试学习轨迹和缓存相关的问题

-- 1. 查询指定用户的有效学习轨迹
-- 获取用户ID=6的最新学习轨迹数据
SELECT id, user_id, version, created_at, updated_at, expires_at 
FROM learning_paths 
WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW()) 
ORDER BY created_at DESC;

-- 2. 检查聚类缓存状态
-- 查看用户ID=6的聚类缓存情况
SELECT id, user_id, cluster_count, vector_count, version, created_at, expires_at 
FROM cluster_result_cache 
WHERE user_id = 6 
ORDER BY created_at DESC;

-- 3. 检查知识图谱缓存
SELECT id, user_id, version, created_at, expires_at 
FROM knowledge_graph_cache 
WHERE user_id = 6 
ORDER BY created_at DESC;

-- 4. 检查用户记忆数量
-- 统计用户ID=6的记忆数量
SELECT COUNT(*) AS memory_count 
FROM memories 
WHERE user_id = 6;

-- 5. 检查向量嵌入相关记忆数量
-- 统计用户ID=6的记忆中有多少条已有向量嵌入
SELECT COUNT(*) AS memory_with_embedding_count 
FROM memories m 
JOIN memory_embeddings e ON m.id = e.memory_id 
WHERE m.user_id = 6;

-- 6. 查询学习轨迹的主题内容
-- 查看用户ID=6的学习轨迹中的主题数据
SELECT id, user_id, topics 
FROM learning_paths 
WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW()) 
ORDER BY created_at DESC 
LIMIT 1;

-- 7. 分析JSON主题字段
-- 从学习轨迹表中提取JSON数组中的单个主题
SELECT 
  id, 
  user_id,
  jsonb_array_elements(topics) AS topic_data
FROM learning_paths 
WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW()) 
ORDER BY created_at DESC 
LIMIT 1;

-- 8. 清理过期缓存数据
-- 删除所有过期的聚类缓存
DELETE FROM cluster_result_cache 
WHERE expires_at < NOW();

-- 9. 检查学习轨迹中的中文主题名称
-- 从学习轨迹表中提取并分析包含中文的主题
WITH topic_data AS (
  SELECT 
    jsonb_array_elements(topics) AS topic_json
  FROM learning_paths 
  WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW()) 
  ORDER BY created_at DESC 
  LIMIT 1
)
SELECT 
  topic_json->>'id' AS topic_id,
  topic_json->>'name' AS topic_name,
  topic_json->>'description' AS topic_description
FROM topic_data;

-- 10. 检查学习轨迹的更新历史
-- 查询用户ID=6的学习轨迹更新历史
SELECT 
  id, 
  user_id,
  version,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at)) AS update_interval_seconds
FROM learning_paths
WHERE user_id = 6
ORDER BY created_at DESC;

-- 11. 检查并分析知识图谱数据
-- 检查知识图谱缓存中的节点和连接数量
SELECT 
  id, 
  user_id,
  jsonb_array_length(nodes) AS node_count,
  jsonb_array_length(links) AS link_count,
  created_at,
  updated_at
FROM knowledge_graph_cache
WHERE user_id = 6
ORDER BY created_at DESC
LIMIT 1;

-- 12. 检查数据库中的主题分布情况
-- 从学习轨迹表中提取主题分布数据
SELECT 
  id, 
  user_id,
  distribution
FROM learning_paths
WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT 1;

-- 13. 检查学习轨迹建议数据
-- 从学习轨迹表中提取建议数据
SELECT 
  id, 
  user_id,
  jsonb_array_elements(suggestions) AS suggestion_data
FROM learning_paths
WHERE user_id = 6 AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY created_at DESC
LIMIT 1;

-- 14. 查看用户的最近记忆
-- 获取用户ID=6的最近记忆内容
SELECT 
  id, 
  user_id,
  LEFT(content, 100) AS content_preview,
  type,
  timestamp,
  LEFT(summary, 100) AS summary_preview
FROM memories
WHERE user_id = 6
ORDER BY timestamp DESC
LIMIT 10;

-- 15. 支持查询调试的多表关联查询
-- 获取用户的记忆、向量和关键词统计信息
SELECT 
  u.id AS user_id,
  u.username,
  COUNT(DISTINCT m.id) AS memory_count,
  COUNT(DISTINCT e.id) AS embedding_count,
  COUNT(DISTINCT k.id) AS keyword_count,
  COUNT(DISTINCT lp.id) AS learning_path_count
FROM users u
LEFT JOIN memories m ON u.id = m.user_id
LEFT JOIN memory_embeddings e ON m.id = e.memory_id
LEFT JOIN memory_keywords k ON m.id = k.memory_id
LEFT JOIN learning_paths lp ON u.id = lp.user_id
WHERE u.id = 6
GROUP BY u.id, u.username;
