/**
 * 记忆ID格式分析脚本
 * 用于分析和映射文件系统和数据库中的记忆ID格式
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');

// 配置数据库连接
const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT, DATABASE_URL } = process.env;

// 记忆空间目录
const MEMORY_DIR = 'memory_space';

// 查询用户ID
const USER_ID = 6;

// 连接数据库
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not set in environment");
}

const neonConfig = require('@neondatabase/serverless').neonConfig;
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * 从文件系统读取记忆ID
 */
async function getFileSystemMemoryIds() {
  const userDir = path.join(MEMORY_DIR, USER_ID.toString());
  
  if (!fs.existsSync(userDir)) {
    console.log(`用户目录不存在: ${userDir}`);
    return [];
  }
  
  const fileIds = fs.readdirSync(userDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
  
  console.log(`文件系统中找到 ${fileIds.length} 条记忆`);
  return fileIds;
}

/**
 * 从数据库读取记忆ID
 */
async function getDatabaseMemoryIds() {
  try {
    const result = await pool.query('SELECT id FROM memories WHERE user_id = $1', [USER_ID]);
    console.log(`数据库中找到 ${result.rows.length} 条记忆`);
    return result.rows.map(row => row.id);
  } catch (error) {
    console.error(`查询数据库时出错: ${error}`);
    return [];
  }
}

/**
 * 从数据库获取记忆嵌入
 */
async function getMemoryEmbeddings() {
  try {
    const result = await pool.query('SELECT id, memory_id FROM memory_embeddings');
    console.log(`数据库中找到 ${result.rows.length} 个记忆嵌入`);
    return result.rows;
  } catch (error) {
    console.error(`查询嵌入时出错: ${error}`);
    return [];
  }
}

/**
 * 主函数
 */
async function analyzeMemoryIds() {
  try {
    console.log('=== 开始记忆ID分析 ===');
    
    // 获取两种来源的ID
    const fileIds = await getFileSystemMemoryIds();
    const dbIds = await getDatabaseMemoryIds();
    const embeddings = await getMemoryEmbeddings();
    
    // 打印样例ID
    console.log('\n文件系统ID样例:');
    fileIds.slice(0, 5).forEach(id => console.log(`  ${id}`));
    
    console.log('\n数据库ID样例:');
    dbIds.slice(0, 5).forEach(id => console.log(`  ${id}`));
    
    console.log('\n向量嵌入ID样例:');
    embeddings.slice(0, 5).forEach(e => console.log(`  嵌入ID: ${e.id}, 记忆ID: ${e.memory_id}`));
    
    // 尝试创建映射表
    console.log('\n尝试创建ID映射表...');
    
    // 查询所有用户6的记忆，并打印详细信息
    const memoriesResult = await pool.query(
      'SELECT m.id, m.content, me.id AS embedding_id, me.memory_id FROM memories m LEFT JOIN memory_embeddings me ON m.id = me.memory_id WHERE m.user_id = $1 LIMIT 10',
      [USER_ID]
    );
    
    console.log('\n记忆和嵌入详细信息:');
    memoriesResult.rows.forEach(row => {
      console.log(`记忆ID: ${row.id}`);
      console.log(`内容: ${row.content ? row.content.substring(0, 50) + '...' : 'N/A'}`);
      console.log(`嵌入ID: ${row.embedding_id || 'N/A'}`);
      console.log(`嵌入引用记忆ID: ${row.memory_id || 'N/A'}`);
      console.log('---');
    });
    
    // 检查数据库记忆是否有对应的嵌入
    const memoryIdsWithEmbeddings = embeddings.map(e => e.memory_id);
    const dbIdsWithEmbeddings = dbIds.filter(id => memoryIdsWithEmbeddings.includes(id));
    
    console.log(`\n数据库中有 ${dbIdsWithEmbeddings.length} 条记忆有对应的嵌入`);
    
    // 结束连接
    await pool.end();
    
    console.log('\n=== 分析完成 ===');
  } catch (error) {
    console.error(`分析记忆ID时出错: ${error}`);
  }
}

// 运行分析
analyzeMemoryIds();