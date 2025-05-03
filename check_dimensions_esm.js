/**
 * ESM版本的向量维度检查脚本
 * 使用ESM兼容的语法
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const { Pool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 颜色格式化工具
const color = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m'
};

/**
 * 打印彩色日志
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colorCode = type === 'info' ? color.cyan : type === 'warn' ? color.yellow : type === 'error' ? color.red : color.green;
  
  console.log(`${colorCode}${message}${color.reset}`);
}

/**
 * 检查向量维度
 */
async function checkVectorDimensions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    log('=== 检查向量嵌入维度 ===');
    
    // 获取向量维度统计
    const dimensionsResult = await pool.query(`
      SELECT 
        CASE 
          WHEN array_length(vector_embedding, 1) IS NULL THEN 'NULL'
          ELSE array_length(vector_embedding, 1)::text
        END as dimension,
        COUNT(*) as count
      FROM memories
      GROUP BY dimension
      ORDER BY dimension
    `);
    
    if (dimensionsResult.rows.length === 0) {
      log('没有找到任何向量嵌入记录', 'warn');
      return;
    }
    
    log('向量维度分布:');
    let totalMemories = 0;
    let correctDimensionCount = 0;
    
    for (const row of dimensionsResult.rows) {
      const dimension = row.dimension;
      const count = parseInt(row.count);
      totalMemories += count;
      
      if (dimension === '3072') {
        correctDimensionCount += count;
        log(`  维度 ${dimension}: ${count} 条记忆 ✓`, 'success');
      } else {
        log(`  维度 ${dimension}: ${count} 条记忆 ✗`, 'error');
      }
    }
    
    // 计算百分比
    const correctPercentage = ((correctDimensionCount / totalMemories) * 100).toFixed(2);
    log(`总记忆数: ${totalMemories}`, 'info');
    log(`正确维度(3072)记忆数: ${correctDimensionCount}`, 'info');
    log(`正确维度百分比: ${correctPercentage}%`, 'info');
    
    // 获取几个示例ID
    const sampleResult = await pool.query(`
      SELECT id, array_length(vector_embedding, 1) as dimension
      FROM memories
      WHERE vector_embedding IS NOT NULL
      ORDER BY random()
      LIMIT 5
    `);
    
    log('\n随机向量嵌入样本:');
    for (const row of sampleResult.rows) {
      log(`  记忆ID: ${row.id}, 维度: ${row.dimension}`, row.dimension === 3072 ? 'success' : 'error');
    }
    
    // 检查异常维度
    const abnormalResult = await pool.query(`
      SELECT id, array_length(vector_embedding, 1) as dimension
      FROM memories
      WHERE vector_embedding IS NOT NULL AND array_length(vector_embedding, 1) != 3072
      LIMIT 10
    `);
    
    if (abnormalResult.rows.length > 0) {
      log('\n发现异常维度的向量嵌入:', 'error');
      for (const row of abnormalResult.rows) {
        log(`  记忆ID: ${row.id}, 维度: ${row.dimension}`, 'error');
      }
    } else {
      log('\n未发现异常维度的向量嵌入', 'success');
    }
  } catch (error) {
    log(`检查向量维度时出错: ${error}`, 'error');
  } finally {
    pool.end();
  }
}

// 执行检查
checkVectorDimensions();
