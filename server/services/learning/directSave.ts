/**
 * learning/directSave.ts - 直接数据库保存模块
 * 该模块提供简化的学习路径直接存储功能
 * 不使用ORM，而是直接使用SQL语句保存数据
 */

import { pool } from '../../db';
import { log } from '../../vite';

/**
 * 清除学习路径数据
 * @param userId 用户ID
 */
export async function clearLearningPath(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM learning_paths WHERE user_id = $1', [userId]);
    log(`[路径清除] 已清除用户 ${userId} 的学习路径数据`);
  } catch (error) {
    console.error(`[路径清除错误] ${error instanceof Error ? error.message : error}`);
  } finally {
    client.release();
  }
}

/**
 * 直接保存学习路径数据
 * 使用原生SQL而非Drizzle ORM
 * 
 * @param userId 用户ID
 * @param topics 主题数据
 * @param distribution 分布数据
 * @param suggestions 建议数据
 * @param knowledgeGraph 知识图谱数据（可选）
 * @param isOptimized 是否已优化
 * @returns 插入或更新的记录
 */
export async function directSaveLearningPath(
  userId: number,
  topics: any[],
  distribution: any[],
  suggestions: string[],
  knowledgeGraph?: any,
  isOptimized: boolean = false
): Promise<any> {
  try {
    console.log(`[DB-SAVE-INFO] 开始保存学习轨迹 userId=${userId}, topics=${topics?.length || 0}`);
    log(`[trajectory-direct] 开始直接保存学习轨迹数据，用户ID=${userId}`);
    
    // 第一步：清除现有数据
    await clearLearningPath(userId);
    console.log(`[DB-SAVE-CLEAR] 已清除用户${userId}的现有学习轨迹数据`);
    
    // 第二步：准备简化的数据
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
    
    // 确保主题数据有效
    const safeTopics = topics && Array.isArray(topics) ? 
      topics.map(t => ({
        id: t.id || `topic_${Math.random().toString(36).slice(2, 7)}`,
        topic: String(t.topic || '未命名主题'),
        percentage: Number(t.percentage || 0),
        count: Number(t.count || 0)
      })) : 
      [{ id: `topic_default_${Date.now()}`, topic: '默认主题', percentage: 100, count: 1 }];
    
    // 创建分布数据
    const safeDistribution = safeTopics.map(t => ({
      id: t.id,
      name: String(t.topic),
      topic: String(t.topic),
      percentage: Number(t.percentage || 0)
    }));
    
    // 确保建议数据有效
    const safeSuggestions = Array.isArray(suggestions) && suggestions.length > 0 ? 
      suggestions : 
      ['继续学习当前主题以加深理解', '探索新的学习领域'];
    
    // 创建进度历史
    const progressHistory = [{
      date: now.toISOString().split('T')[0],
      topics: safeDistribution
    }];
    
    // 第三步：使用原始SQL语句直接插入数据库
    console.log(`[DB-SQL-INSERT] 准备直接SQL插入数据，用户ID=${userId}`);
    
    // 获取客户端连接
    const client = await pool.connect();
    try {
      // 准备SQL语句
      const insertSql = `
        INSERT INTO learning_paths 
          (user_id, topics, distribution, suggestions, progress_history, knowledge_graph, 
           version, created_at, updated_at, expires_at, is_optimized)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;
      `;
      
      // 准备参数
      const params = [
        userId,                                  // user_id
        JSON.stringify(safeTopics),              // topics
        JSON.stringify(safeDistribution),        // distribution
        JSON.stringify(safeSuggestions),         // suggestions
        JSON.stringify(progressHistory),         // progress_history
        knowledgeGraph ? JSON.stringify(knowledgeGraph) : null,  // knowledge_graph
        1,                                       // version
        now,                                     // created_at
        now,                                     // updated_at
        expiresAt,                               // expires_at
        isOptimized                              // is_optimized
      ];
      
      console.log(`[DB-SQL-PARAMS] SQL参数：用户ID=${userId}, 主题数=${safeTopics.length}`);
      
      // 执行查询
      const result = await client.query(insertSql, params);
      const newPathId = result.rows[0]?.id;
      
      console.log(`[DB-SQL-SUCCESS] 成功插入学习轨迹数据，ID=${newPathId}, 用户ID=${userId}`);
      return { id: newPathId, user_id: userId };
    } catch (sqlError) {
      // 详细记录SQL错误
      console.error(`[DB-SQL-ERROR] SQL插入失败: ${sqlError.message}`);
      console.error(`[DB-SQL-ERROR-DETAIL] ${sqlError.detail || '无详细信息'}`);
      if (sqlError.stack) console.error(`[DB-SQL-ERROR-STACK] ${sqlError.stack}`);
      return null;
    } finally {
      // 释放客户端连接
      client.release();
    }
  } catch (error) {
    console.error(`[DB-SAVE-FATAL] 致命错误: ${error instanceof Error ? error.message : error}`);
    log(`[trajectory-direct] 保存学习轨迹数据失败: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
