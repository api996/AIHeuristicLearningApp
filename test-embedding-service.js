/**
 * 测试嵌入服务脚本
 * 创建一条新的记忆并验证嵌入服务能否正确工作
 */

import { db } from './server/db.js';
import { memories, memoryEmbeddings } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// 生成时间戳ID
function generateTimestampId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${random}`;
}

// 创建一条测试记忆
async function createTestMemory() {
  console.log('开始创建测试记忆...');
  
  const userId = 6; // E23用户ID
  const memoryId = generateTimestampId();
  const content = `
    这是一段关于人工智能学习的对话记录。用户向AI提问关于深度学习和自然语言处理的基础知识。
    
    用户: 你能解释一下深度学习和传统机器学习的区别吗？
    AI: 深度学习是机器学习的一个子集，它使用神经网络模型，特别是具有多层（深层）结构的神经网络。主要区别在于：
    1. 特征提取：传统机器学习需要手动特征工程，而深度学习能自动学习特征。
    2. 数据量：深度学习通常需要更大量的数据才能有效训练。
    3. 计算资源：深度学习模型计算密集，通常需要GPU加速。
    4. 复杂性：深度学习模型可以学习更复杂的模式和表示。
    
    用户: 那么自然语言处理中的Transformer模型是如何工作的？
    AI: Transformer是一种革命性的架构，主要基于自注意力机制。它的工作方式包括：
    1. 自注意力机制：允许模型关注输入序列中的不同部分，同时为每个部分分配权重。
    2. 多头注意力：并行计算多组注意力，捕获不同角度的信息。
    3. 位置编码：由于没有循环或卷积，通过位置编码提供序列中词的位置信息。
    4. 编码器-解码器结构：编码器处理输入序列，解码器生成输出。
    
    Transformer模型是大多数现代NLP系统的基础，如BERT、GPT等都基于此架构。
  `;
  
  const summary = "深度学习与传统机器学习的区别及Transformer模型工作原理探讨";
  
  try {
    // 插入新记忆
    const [memory] = await db.insert(memories).values({
      id: memoryId,
      userId,
      content,
      summary,
      type: "dialogue",
      createdAt: new Date()
    }).returning();
    
    console.log(`✓ 成功创建测试记忆，ID: ${memoryId}`);
    return memoryId;
  } catch (error) {
    console.error(`创建测试记忆失败: ${error.message}`);
    throw error;
  }
}

// 检查是否已生成向量嵌入
async function checkMemoryEmbedding(memoryId, maxAttempts = 10) {
  console.log(`开始检查记忆 ${memoryId} 的向量嵌入`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // 查询嵌入记录
      const [embedding] = await db.select()
        .from(memoryEmbeddings)
        .where(eq(memoryEmbeddings.memoryId, memoryId));
      
      if (embedding) {
        console.log(`✓ 发现向量嵌入记录，尝试次数: ${i + 1}`);
        
        // 检查向量数据
        const vectorData = embedding.vectorData;
        console.log(`向量数据类型: ${typeof vectorData}`);
        
        if (Array.isArray(vectorData)) {
          console.log(`✓ 向量维度: ${vectorData.length}`);
          return true;
        } else if (typeof vectorData === 'object') {
          console.log(`✓ 向量数据是对象类型`);
          return true;
        } else {
          console.log(`× 向量数据格式异常: ${typeof vectorData}`);
          return false;
        }
      }
      
      console.log(`等待嵌入生成，尝试 ${i + 1}/${maxAttempts}...`);
      // 等待10秒再次检查
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.error(`检查向量嵌入出错: ${error.message}`);
    }
  }
  
  console.log(`× 达到最大尝试次数，未发现向量嵌入`);
  return false;
}

// 主函数
async function main() {
  try {
    console.log('开始测试嵌入服务...');
    
    // 创建测试记忆
    const memoryId = await createTestMemory();
    
    // 等待10秒，让系统有时间处理嵌入生成
    console.log('等待系统处理嵌入生成...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 检查是否已生成向量嵌入
    const success = await checkMemoryEmbedding(memoryId);
    
    if (success) {
      console.log('🎉 测试成功：嵌入服务正常工作！');
    } else {
      console.log('❌ 测试失败：嵌入服务可能存在问题');
    }
    
  } catch (error) {
    console.error(`测试脚本执行失败: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

// 执行主函数
main();