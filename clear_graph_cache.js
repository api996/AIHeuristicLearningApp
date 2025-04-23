/**
 * 清理知识图谱缓存的脚本
 * 用于解决缓存中主题名称与最新生成的主题名称不一致的问题
 */

import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载环境变量
config({ path: join(__dirname, '.env') });
config({ path: join(__dirname, 'server', '.env') });

// 调试日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warning: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${reset}`);
}

// 主函数
async function clearKnowledgeGraphCache() {
  if (!process.env.DATABASE_URL) {
    log('未找到数据库连接URL，请检查环境变量', 'error');
    return;
  }

  // 创建数据库连接
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    log('正在连接数据库...');
    
    // 获取用户ID=6的图谱缓存
    const { rows: existingCaches } = await pool.query(
      'SELECT id, user_id, version, created_at FROM knowledge_graph_cache WHERE user_id = $1',
      [6]
    );
    
    if (existingCaches.length === 0) {
      log('未找到用户ID=6的知识图谱缓存', 'warning');
    } else {
      log(`找到 ${existingCaches.length} 条知识图谱缓存记录：`);
      
      existingCaches.forEach(cache => {
        log(`  - ID: ${cache.id}, 用户: ${cache.user_id}, 版本: ${cache.version}, 创建时间: ${cache.created_at}`);
      });
      
      // 删除所有用户ID=6的图谱缓存
      const { rowCount } = await pool.query(
        'DELETE FROM knowledge_graph_cache WHERE user_id = $1',
        [6]
      );
      
      log(`成功删除 ${rowCount} 条知识图谱缓存记录`, 'success');
    }
    
    // 检查聚类缓存
    const { rows: clusterCaches } = await pool.query(
      'SELECT id, user_id, version, created_at FROM memory_cluster_cache WHERE user_id = $1',
      [6]
    );
    
    if (clusterCaches.length === 0) {
      log('未找到用户ID=6的聚类缓存', 'warning');
    } else {
      log(`找到 ${clusterCaches.length} 条聚类缓存记录：`);
      
      clusterCaches.forEach(cache => {
        log(`  - ID: ${cache.id}, 用户: ${cache.user_id}, 版本: ${cache.version}, 创建时间: ${cache.created_at}`);
      });
      
      // 删除所有用户ID=6的聚类缓存
      const { rowCount } = await pool.query(
        'DELETE FROM memory_cluster_cache WHERE user_id = $1',
        [6]
      );
      
      log(`成功删除 ${rowCount} 条聚类缓存记录`, 'success');
    }
    
    log('缓存清理完成，请刷新页面生成新的知识图谱', 'success');
  } catch (error) {
    log(`清理缓存时出错: ${error}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行主函数
clearKnowledgeGraphCache().catch(err => {
  log(`执行过程中发生错误: ${err}`, 'error');
});