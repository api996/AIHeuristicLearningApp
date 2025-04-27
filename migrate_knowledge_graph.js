/**
 * 知识图谱数据迁移脚本
 * 将现有数据从learning_paths表的knowledgeGraph字段迁移到knowledgeGraphCache表
 */
const { Pool } = require('pg');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warn: '\x1b[33m%s\x1b[0m',     // 黄色
    error: '\x1b[31m%s\x1b[0m',    // 红色
  };
  
  console.log(colors[type] || colors.info, message);
}

/**
 * 获取需要迁移的学习轨迹数据
 */
async function getLearningPathsWithKnowledgeGraph() {
  const query = `
    SELECT user_id, knowledge_graph 
    FROM learning_paths 
    WHERE knowledge_graph IS NOT NULL 
    AND knowledge_graph::text != 'null'
    AND knowledge_graph::text != '{}'
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * 获取已存在的知识图谱缓存记录
 */
async function getExistingKnowledgeGraphCache() {
  const query = `
    SELECT user_id 
    FROM knowledge_graph_cache
  `;
  
  const result = await pool.query(query);
  return result.rows.map(row => row.user_id);
}

/**
 * 将知识图谱数据迁移到专用缓存表
 */
async function migrateKnowledgeGraphData() {
  try {
    log('开始知识图谱数据迁移...', 'info');
    
    // 获取需要迁移的数据
    const learningPaths = await getLearningPathsWithKnowledgeGraph();
    log(`找到 ${learningPaths.length} 条包含知识图谱数据的学习轨迹记录`, 'info');
    
    // 获取已存在的知识图谱缓存记录
    const existingCacheUserIds = await getExistingKnowledgeGraphCache();
    log(`知识图谱缓存表中已有 ${existingCacheUserIds.length} 条记录`, 'info');
    
    // 计算需要迁移的用户ID
    const userIdsToMigrate = learningPaths
      .map(path => path.user_id)
      .filter(userId => !existingCacheUserIds.includes(userId));
    
    log(`需要迁移 ${userIdsToMigrate.length} 条记录`, 'info');
    
    // 迁移数据
    let successCount = 0;
    let failCount = 0;
    
    for (const path of learningPaths) {
      const userId = path.user_id;
      
      // 跳过已有缓存的用户
      if (existingCacheUserIds.includes(userId)) {
        log(`用户 ${userId} 已有知识图谱缓存记录，跳过`, 'warn');
        continue;
      }
      
      try {
        // 确保知识图谱数据存在且有效
        if (!path.knowledge_graph || !path.knowledge_graph.nodes || !path.knowledge_graph.links) {
          log(`用户 ${userId} 的知识图谱数据不完整，跳过`, 'warn');
          continue;
        }
        
        // 插入知识图谱缓存记录
        const insertQuery = `
          INSERT INTO knowledge_graph_cache 
          (user_id, nodes, links, version, created_at, updated_at, expires_at)
          VALUES ($1, $2, $3, 1, NOW(), NOW(), NOW() + INTERVAL '1 day')
          ON CONFLICT (user_id) DO NOTHING
        `;
        
        await pool.query(insertQuery, [
          userId,
          JSON.stringify(path.knowledge_graph.nodes),
          JSON.stringify(path.knowledge_graph.links)
        ]);
        
        log(`成功迁移用户 ${userId} 的知识图谱数据`, 'success');
        successCount++;
      } catch (error) {
        log(`迁移用户 ${userId} 的知识图谱数据失败: ${error}`, 'error');
        failCount++;
      }
    }
    
    log(`迁移完成：成功 ${successCount} 条，失败 ${failCount} 条`, 'info');
    
    // 可选：从learning_paths表中清除knowledgeGraph字段数据
    if (successCount > 0) {
      const clearConfirm = process.argv.includes('--clear');
      
      if (clearConfirm) {
        log('开始清除learning_paths表中的知识图谱数据...', 'info');
        
        const clearQuery = `
          UPDATE learning_paths
          SET knowledge_graph = NULL
          WHERE user_id IN (${userIdsToMigrate.join(',')})
        `;
        
        if (userIdsToMigrate.length > 0) {
          await pool.query(clearQuery);
          log(`已清除 ${userIdsToMigrate.length} 条记录的知识图谱数据`, 'success');
        } else {
          log('没有需要清除的记录', 'info');
        }
      } else {
        log('跳过清除操作。如需清除旧数据，请使用 --clear 参数重新运行脚本', 'warn');
      }
    }
    
  } catch (error) {
    log(`迁移过程中发生错误: ${error}`, 'error');
  } finally {
    // 关闭连接池
    pool.end();
  }
}

// 运行迁移
migrateKnowledgeGraphData().catch(err => {
  log(`迁移脚本执行失败: ${err}`, 'error');
  process.exit(1);
});