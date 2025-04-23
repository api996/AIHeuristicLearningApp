/**
 * 向量维度修复脚本
 * 查找并修复数据库中所有非3072维的向量嵌入
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建数据库连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 标准颜色用于日志输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * 带颜色的日志输出
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  
  switch(type) {
    case 'error':
      console.error(`${colors.red}[${timestamp}] 错误: ${message}${colors.reset}`);
      break;
    case 'warning':
      console.warn(`${colors.yellow}[${timestamp}] 警告: ${message}${colors.reset}`);
      break;
    case 'success':
      console.log(`${colors.green}[${timestamp}] 成功: ${message}${colors.reset}`);
      break;
    case 'info':
    default:
      console.log(`${colors.blue}[${timestamp}] 信息: ${message}${colors.reset}`);
  }
}

/**
 * 标准化向量维度
 * @param {number[]} vector - 原始向量
 * @param {number} targetDimension - 目标维度
 * @returns {number[]} - 标准化后的向量
 */
function normalizeVectorDimension(vector, targetDimension = 3072) {
  if (!vector || vector.length === 0) {
    // 对于空向量，返回全零向量
    return new Array(targetDimension).fill(0);
  }

  const currentDimension = vector.length;
  
  if (currentDimension === targetDimension) {
    // 如果维度已经匹配，直接返回
    return vector;
  }
  
  log(`标准化向量: ${currentDimension}维 => ${targetDimension}维`);

  if (currentDimension < targetDimension) {
    // 对于较小维度的向量，通过重复内容扩展
    const repeats = Math.floor(targetDimension / currentDimension) + 1;
    let extendedVector = [];
    
    for (let i = 0; i < repeats; i++) {
      extendedVector = extendedVector.concat(vector);
    }
    
    // 截断到目标维度
    return extendedVector.slice(0, targetDimension);
  } else {
    // 对于较大维度的向量，截断到目标维度
    return vector.slice(0, targetDimension);
  }
}

/**
 * 计算系统中向量维度的统计信息
 */
async function analyzeVectorDimensions() {
  log('开始分析向量维度...');
  
  try {
    const query = `
      SELECT 
        memory_id, 
        ARRAY_LENGTH(vector_embedding, 1) as vector_dimension,
        COUNT(*) as count
      FROM memory_embeddings
      GROUP BY memory_id, ARRAY_LENGTH(vector_embedding, 1)
      ORDER BY vector_dimension;
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      log('没有找到任何向量嵌入记录。', 'warning');
      return;
    }
    
    // 分析结果
    const dimensions = {};
    let totalVectors = 0;
    
    result.rows.forEach(row => {
      const dimension = row.vector_dimension;
      const count = parseInt(row.count);
      
      dimensions[dimension] = (dimensions[dimension] || 0) + count;
      totalVectors += count;
    });
    
    // 打印统计信息
    log(`系统中共有 ${totalVectors} 个向量嵌入记录，维度分布如下:`);
    
    Object.entries(dimensions).forEach(([dimension, count]) => {
      const percentage = ((count / totalVectors) * 100).toFixed(2);
      const status = parseInt(dimension) === 3072 ? '(正确)' : '(需修复)';
      log(`  - ${dimension}维: ${count}个 (${percentage}%) ${status}`);
    });
    
    return dimensions;
  } catch (error) {
    log(`分析向量维度时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 修复所有非3072维的向量
 */
async function fixVectorDimensions() {
  log('开始修复向量维度...');
  
  try {
    // 1. 找出所有非3072维的向量
    const findQuery = `
      SELECT memory_id, vector_embedding, ARRAY_LENGTH(vector_embedding, 1) as dimension
      FROM memory_embeddings
      WHERE ARRAY_LENGTH(vector_embedding, 1) != 3072;
    `;
    
    const result = await pool.query(findQuery);
    
    if (result.rows.length === 0) {
      log('没有找到需要修复的向量嵌入记录。', 'success');
      return 0;
    }
    
    log(`找到 ${result.rows.length} 个需要修复的向量嵌入记录。`);
    
    // 2. 对每个向量应用标准化并更新数据库
    let fixedCount = 0;
    
    for (const row of result.rows) {
      const { memory_id, vector_embedding, dimension } = row;
      
      // 应用标准化
      const normalizedVector = normalizeVectorDimension(vector_embedding);
      
      // 更新数据库
      const updateQuery = `
        UPDATE memory_embeddings
        SET vector_embedding = $1
        WHERE memory_id = $2;
      `;
      
      await pool.query(updateQuery, [normalizedVector, memory_id]);
      
      fixedCount++;
      if (fixedCount % 100 === 0) {
        log(`已修复 ${fixedCount}/${result.rows.length} 个向量...`);
      }
    }
    
    log(`成功修复了 ${fixedCount} 个向量嵌入记录。`, 'success');
    return fixedCount;
  } catch (error) {
    log(`修复向量维度时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 验证修复结果
 */
async function verifyFix() {
  log('验证修复结果...');
  
  try {
    const query = `
      SELECT 
        ARRAY_LENGTH(vector_embedding, 1) as dimension,
        COUNT(*) as count
      FROM memory_embeddings
      GROUP BY ARRAY_LENGTH(vector_embedding, 1);
    `;
    
    const result = await pool.query(query);
    
    let allCorrect = true;
    
    for (const row of result.rows) {
      if (row.dimension !== 3072) {
        log(`仍有 ${row.count} 个 ${row.dimension}维 的向量存在。`, 'warning');
        allCorrect = false;
      }
    }
    
    if (allCorrect) {
      log('所有向量均已标准化为3072维。', 'success');
    }
    
    return allCorrect;
  } catch (error) {
    log(`验证修复结果时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  log('开始向量维度修复流程...');
  
  try {
    // 1. 分析向量维度
    await analyzeVectorDimensions();
    
    // 2. 修复非3072维的向量
    const fixedCount = await fixVectorDimensions();
    
    if (fixedCount > 0) {
      // 3. 验证修复结果
      const verified = await verifyFix();
      
      if (verified) {
        log('向量维度修复完成! 所有向量现在都是3072维。', 'success');
      } else {
        log('向量维度修复不完全，请检查日志并重新运行脚本。', 'warning');
      }
    } else {
      log('无需修复任何向量维度。', 'success');
    }
  } catch (error) {
    log(`向量维度修复失败: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
    log('数据库连接已关闭。');
  }
}

// 执行主函数
main();