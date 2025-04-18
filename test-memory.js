/**
 * 记忆系统测试脚本
 * 测试从数据库读取记忆和创建新记忆，以及记忆聚类功能
 */

import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';
import { db } from './server/db';
import { memories, keywords, embeddings } from './shared/schema';
import { eq } from 'drizzle-orm';

// 色彩日志函数
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[34m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 测试用户ID（使用7，因为这个ID已经有记忆数据）
const testUserId = 7;

// 测试跳过用户ID=1的记忆数据
const skipUserId = 1;

/**
 * 测试基本记忆操作
 */
async function testBasicMemoryOperations() {
  log('===== 测试基本记忆操作 =====', 'info');
  
  try {
    // 1. 测试获取记忆
    log(`\n1. 获取用户${testUserId}的记忆：`, 'info');
    const memories = await storage.getMemoriesByUserId(testUserId);
    log(`找到${memories.length}条记忆`, 'success');
    
    if (memories.length > 0) {
      // 显示第一条记忆的信息
      const firstMemory = memories[0];
      log(`记忆ID: ${firstMemory.id}`, 'info');
      log(`记忆类型: ${firstMemory.type}`, 'info');
      log(`记忆摘要: ${firstMemory.summary?.substring(0, 100)}...`, 'info');
      
      // 获取记忆关键词
      const keywords = await storage.getKeywordsByMemoryId(firstMemory.id);
      log(`关键词: ${keywords.map(k => k.keyword).join(', ')}`, 'info');
      
      // 获取记忆向量
      const embedding = await storage.getEmbeddingByMemoryId(firstMemory.id);
      if (embedding) {
        log(`向量维度: ${embedding.vectorData.length}`, 'success');
        
        // 检查向量维度是否正确
        if (embedding.vectorData.length === 768 || embedding.vectorData.length === 3072) {
          log(`向量维度正常 (${embedding.vectorData.length})`, 'success');
        } else {
          log(`警告: 非标准向量维度 (${embedding.vectorData.length})`, 'warning');
        }
      } else {
        log('没有找到向量嵌入', 'warning');
      }
    }
    
    // 2. 测试创建新记忆
    log('\n2. 创建测试记忆：', 'info');
    const testContent = `这是一个在${new Date().toLocaleString()}创建的测试记忆。用于验证记忆系统的数据库存储功能是否正常工作。`;
    
    const startTime = Date.now();
    const newMemory = await memoryService.createMemory(testUserId, testContent, 'test');
    const endTime = Date.now();
    log(`创建的记忆ID: ${newMemory.id}`, 'success');
    log(`创建耗时: ${endTime - startTime}ms`, 'info');
    
    // 3. 获取新创建的记忆
    log('\n3. 验证新创建的记忆：', 'info');
    const createdMemory = await storage.getMemoryById(newMemory.id);
    if (createdMemory) {
      log(`新记忆已成功保存到数据库`, 'success');
      log(`内容: ${createdMemory.content}`, 'info');
      log(`摘要: ${createdMemory.summary}`, 'info');
      
      // 获取关键词
      const newKeywords = await storage.getKeywordsByMemoryId(createdMemory.id);
      log(`生成的关键词: ${newKeywords.map(k => k.keyword).join(', ')}`, 'info');
      
      // 检查是否生成了向量嵌入
      const embedding = await storage.getEmbeddingByMemoryId(createdMemory.id);
      if (embedding) {
        log(`向量嵌入成功创建，维度: ${embedding.vectorData.length}`, 'success');
      } else {
        log('未找到向量嵌入', 'warning');
      }
    } else {
      log('无法获取新创建的记忆，创建失败！', 'error');
    }
    
    return newMemory.id;
  } catch (error) {
    log(`测试基本操作时出错: ${error.message}`, 'error');
    console.error(error);
    return null;
  }
}

/**
 * 测试语义搜索功能
 */
async function testSemanticSearch(newMemoryId) {
  log('\n===== 测试语义搜索功能 =====', 'info');
  
  try {
    log('1. 查找相似记忆：', 'info');
    const similarMemories = await memoryService.findSimilarMemories(testUserId, '测试记忆系统功能', 3);
    log(`找到${similarMemories.length}条相似记忆`, 'success');
    
    // 显示找到的记忆信息
    for (const memory of similarMemories) {
      log(`- ID: ${memory.id}, 摘要: ${memory.summary?.substring(0, 50)}...`, 'info');
      if (memory.id === newMemoryId) {
        log(`  ✓ 刚创建的测试记忆被正确找到`, 'success');
      }
    }
    
    // 测试时间范围搜索
    log('\n2. 测试带时间范围的搜索：', 'info');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // 一天前
    
    const recentMemories = await memoryService.findMemoriesByDateRange(
      testUserId, 
      startDate.toISOString(),
      new Date().toISOString()
    );
    
    log(`找到${recentMemories.length}条最近24小时内的记忆`, 'info');
    
    return similarMemories.length > 0;
  } catch (error) {
    log(`测试语义搜索时出错: ${error.message}`, 'error');
    console.error(error);
    return false;
  }
}

/**
 * 测试记忆聚类功能
 */
async function testMemoryClustering() {
  log('\n===== 测试记忆聚类功能 =====', 'info');
  
  try {
    // 检查是否有足够的记忆用于聚类
    const memories = await storage.getMemoriesByUserId(testUserId);
    if (memories.length < 5) {
      log(`记忆数量不足(${memories.length})，聚类需要至少5条记忆`, 'warning');
      return false;
    }
    
    log(`用户${testUserId}有${memories.length}条记忆，开始聚类分析...`, 'info');
    
    // 获取每个记忆的关键词
    log('获取记忆关键词...', 'info');
    const memoryKeywords = [];
    for (const memory of memories.slice(0, 10)) { // 限制为前10条，避免处理过多
      const keywords = await storage.getKeywordsByMemoryId(memory.id);
      memoryKeywords.push({
        id: memory.id,
        keywords: keywords.map(k => k.keyword)
      });
      
      // 记录关键词
      log(`记忆 #${memory.id} 关键词: ${keywords.map(k => k.keyword).join(', ')}`, 'info');
    }
    
    log(`成功获取${memoryKeywords.length}条记忆的关键词`, 'success');
    
    // 模拟聚类分析
    log('执行关键词聚类分析...', 'info');
    
    // 简单的关键词频率分析
    const keywordFrequency = {};
    memoryKeywords.forEach(item => {
      item.keywords.forEach(keyword => {
        if (!keywordFrequency[keyword]) {
          keywordFrequency[keyword] = 0;
        }
        keywordFrequency[keyword]++;
      });
    });
    
    // 找出最常见的关键词
    const sortedKeywords = Object.entries(keywordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    log('主要主题聚类:', 'success');
    sortedKeywords.forEach(([keyword, count]) => {
      log(`- ${keyword} (出现${count}次)`, 'info');
    });
    
    return true;
  } catch (error) {
    log(`测试记忆聚类时出错: ${error.message}`, 'error');
    console.error(error);
    return false;
  }
}

/**
 * 验证用户ID=1的记忆是否被跳过
 */
async function verifyAdminUserMemoriesSkipped() {
  log('\n===== 验证是否跳过管理员用户记忆 =====', 'info');
  
  try {
    // 检查数据库中是否有用户ID=1的记忆
    const adminMemories = await db.select()
      .from(memories)
      .where(eq(memories.userId, skipUserId));
    
    if (adminMemories.length === 0) {
      log(`成功: 未发现用户ID=${skipUserId}的记忆数据`, 'success');
      return true;
    } else {
      log(`注意: 发现${adminMemories.length}条用户ID=${skipUserId}的记忆`, 'warning');
      log('这些记忆不应该被迁移到数据库', 'warning');
      return false;
    }
  } catch (error) {
    log(`验证管理员记忆时出错: ${error.message}`, 'error');
    console.error(error);
    return false;
  }
}

/**
 * 主测试函数
 */
async function testMemorySystem() {
  log('\n===== 记忆系统测试开始 =====', 'info');
  
  // 验证数据库连接
  try {
    // 执行简单查询测试连接
    const result = await db.select().from(memories).limit(1);
    log('数据库连接成功', 'success');
  } catch (error) {
    log(`数据库连接失败: ${error.message}`, 'error');
    console.error(error);
    return;
  }
  
  // 测试基本操作
  const newMemoryId = await testBasicMemoryOperations();
  
  // 测试语义搜索
  if (newMemoryId) {
    await testSemanticSearch(newMemoryId);
  }
  
  // 测试记忆聚类
  await testMemoryClustering();
  
  // 验证是否跳过了管理员用户的记忆
  await verifyAdminUserMemoriesSkipped();
  
  log('\n===== 测试完成 =====', 'success');
}

// 运行测试
testMemorySystem();