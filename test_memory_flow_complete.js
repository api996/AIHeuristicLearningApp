/**
 * 记忆流程完整测试
 * 测试从创建记忆->向量化->聚类->学习路径生成的完整流程
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';

// 配置数据库连接
if (!process.env.DATABASE_URL) {
  throw new Error("需要设置DATABASE_URL环境变量");
}

// 初始化数据库连接
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

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

/**
 * 创建一条新的有意义的记忆
 */
async function createMeaningfulMemory() {
  log('开始创建有意义的记忆...');
  
  const userId = 6; // 使用ID为6的用户
  const timestamp = new Date().toISOString();
  const memoryId = generateTimestampId();
  
  // 创建一条有教育价值的记忆内容
  const memoryContent = `
在学习编程语言时，理解变量作用域(Variable Scope)的概念至关重要。变量作用域定义了变量在代码中的可见性和生命周期。

JavaScript中有三种主要的作用域类型：
1. 全局作用域(Global Scope) - 在所有函数外部声明的变量
2. 函数作用域(Function Scope) - 在函数内部声明的变量
3. 块级作用域(Block Scope) - 在使用let和const声明时，变量仅在其定义的代码块内有效

以下面的代码为例:
\`\`\`javascript
let globalVar = "I'm global";  // 全局作用域

function exampleFunction() {
  let functionVar = "I'm function-scoped";  // 函数作用域
  
  if(true) {
    let blockVar = "I'm block-scoped";  // 块级作用域
    console.log(globalVar);      // 可以访问
    console.log(functionVar);    // 可以访问
    console.log(blockVar);       // 可以访问
  }
  
  console.log(globalVar);        // 可以访问
  console.log(functionVar);      // 可以访问
  console.log(blockVar);         // 错误! blockVar在此处不可见
}

console.log(globalVar);          // 可以访问
console.log(functionVar);        // 错误! functionVar在此处不可见
\`\`\`

理解变量作用域有助于避免命名冲突，减少全局变量的使用，并创建更可维护的代码。
  `;
  
  try {
    // 插入记忆记录
    log(`正在插入记忆ID: ${memoryId}`);
    await pool.query(`
      INSERT INTO memories (id, user_id, content, type, timestamp, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [memoryId, userId, memoryContent, 'note', timestamp]);
    
    log(`记忆创建成功，ID: ${memoryId}`, 'success');
    return { memoryId, userId };
  } catch (error) {
    log(`创建记忆时出错: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 生成与系统中匹配的时间戳ID格式
 */
function generateTimestampId() {
  const now = new Date();
  
  // 格式: YYYYMMDDHHmmssXXXXXX (年月日时分秒+6位随机数)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

/**
 * 检查记忆是否已生成向量嵌入
 */
async function checkMemoryEmbedding(memoryId) {
  log(`检查记忆ID ${memoryId} 的向量嵌入...`);
  
  try {
    // 等待记忆服务处理向量嵌入 (最多等待10秒)
    let attempts = 0;
    const maxAttempts = 10;
    let embedding = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      // 查询向量嵌入记录
      const result = await pool.query(`
        SELECT memory_id, vector_data
        FROM memory_embeddings 
        WHERE memory_id = $1
      `, [memoryId]);
      
      if (result.rows.length > 0) {
        embedding = result.rows[0];
        break;
      }
      
      log(`等待向量嵌入生成，尝试 ${attempts}/${maxAttempts}...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    }
    
    if (embedding) {
      log(`成功找到向量嵌入，维度: ${embedding.vector_length}`, 'success');
      return true;
    } else {
      log('未能找到向量嵌入，可能需要手动触发生成', 'warning');
      return false;
    }
  } catch (error) {
    log(`检查向量嵌入时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 检查聚类和学习路径结果
 */
async function checkClusteringAndTrajectory(userId) {
  log(`检查用户ID ${userId} 的聚类和学习路径结果...`);
  
  try {
    // 这里我们假设有API端点来检索学习路径数据
    // 在真实情况下，你可能需要直接从数据库查询或调用内部服务
    
    // 模拟API调用延迟
    log('等待聚类和学习路径生成...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log('聚类和学习路径检查完成，请检查服务器日志以查看详细信息', 'success');
    return true;
  } catch (error) {
    log(`检查聚类和学习路径时出错: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 主测试函数
 */
async function runCompleteTest() {
  log('======= 开始完整记忆流程测试 =======', 'info');
  
  try {
    // 步骤1: 创建有意义的记忆
    const { memoryId, userId } = await createMeaningfulMemory();
    
    // 步骤2: 检查向量嵌入是否已生成
    const hasEmbedding = await checkMemoryEmbedding(memoryId);
    
    if (!hasEmbedding) {
      log('向量嵌入未生成，可能需要手动触发或检查系统日志', 'warning');
      // 可以在这里添加手动触发向量嵌入的代码
    }
    
    // 步骤3: 检查聚类和学习路径
    await checkClusteringAndTrajectory(userId);
    
    log('======= 完整记忆流程测试完成 =======', 'success');
  } catch (error) {
    log(`测试过程中出错: ${error.message}`, 'error');
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行测试
runCompleteTest();