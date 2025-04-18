/**
 * 记忆系统测试脚本
 * 测试从数据库读取记忆和创建新记忆
 */

import { storage } from './server/storage';
import { memoryService } from './server/services/learning/memory_service';

// 测试用户ID（使用7，因为这个ID已经有记忆数据）
const testUserId = 7;

async function testMemorySystem() {
  console.log('===== 测试记忆系统 =====');
  
  try {
    // 1. 测试获取记忆
    console.log(`\n1. 获取用户${testUserId}的记忆：`);
    const memories = await storage.getMemoriesByUserId(testUserId);
    console.log(`找到${memories.length}条记忆`);
    
    if (memories.length > 0) {
      // 显示第一条记忆的信息
      const firstMemory = memories[0];
      console.log(`记忆ID: ${firstMemory.id}`);
      console.log(`记忆类型: ${firstMemory.type}`);
      console.log(`记忆摘要: ${firstMemory.summary?.substring(0, 100)}...`);
      
      // 获取记忆关键词
      const keywords = await storage.getKeywordsByMemoryId(firstMemory.id);
      console.log(`关键词: ${keywords.map(k => k.keyword).join(', ')}`);
      
      // 获取记忆向量
      const embedding = await storage.getEmbeddingByMemoryId(firstMemory.id);
      if (embedding) {
        console.log(`向量维度: ${embedding.vectorData.length}`);
      } else {
        console.log('没有找到向量嵌入');
      }
    }
    
    // 2. 测试创建新记忆
    console.log('\n2. 创建测试记忆：');
    const testContent = `这是一个在${new Date().toLocaleString()}创建的测试记忆。用于验证记忆系统的数据库存储功能是否正常工作。`;
    
    const newMemory = await memoryService.createMemory(testUserId, testContent, 'test');
    console.log(`创建的记忆ID: ${newMemory.id}`);
    
    // 3. 获取新创建的记忆
    console.log('\n3. 验证新创建的记忆：');
    const createdMemory = await storage.getMemoryById(newMemory.id);
    if (createdMemory) {
      console.log(`新记忆已成功保存到数据库`);
      console.log(`内容: ${createdMemory.content}`);
      console.log(`摘要: ${createdMemory.summary}`);
      
      // 获取关键词
      const newKeywords = await storage.getKeywordsByMemoryId(createdMemory.id);
      console.log(`生成的关键词: ${newKeywords.map(k => k.keyword).join(', ')}`);
    } else {
      console.log('无法获取新创建的记忆，创建失败！');
    }
    
    // 4. 测试相似记忆搜索
    console.log('\n4. 测试语义搜索：');
    const similarMemories = await memoryService.findSimilarMemories(testUserId, '测试记忆系统', 3);
    console.log(`找到${similarMemories.length}条相似记忆`);
    for (const memory of similarMemories) {
      console.log(`- ID: ${memory.id}, 摘要: ${memory.summary?.substring(0, 50)}...`);
    }
    
    console.log('\n===== 测试完成 =====');
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 运行测试
testMemorySystem();