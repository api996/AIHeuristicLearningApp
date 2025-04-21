/**
 * 记忆向量维度修复工具
 * 用于将低维度向量扩展到目标维度(3072)，使聚类和知识图谱分析能够顺利进行
 */

// 使用CommonJS语法
const { log } = require("./server/vite");
const { db, pool } = require("./server/db");
const { storage } = require("./server/storage");
const { memoryEmbeddings, memories } = require("./shared/schema");
const { eq } = require("drizzle-orm");

// 设置测试用户ID和目标维度
const TEST_USER_ID = 6;
const TARGET_DIMENSION = 3072;

/**
 * 主函数：修复记忆嵌入维度
 */
async function fixMemoryEmbeddingsDimension() {
  try {
    log("==== 开始修复记忆向量维度 ====");
    
    // 获取特定用户的所有记忆
    const userMemories = await storage.getMemoriesByUserId(TEST_USER_ID);
    log(`找到用户ID=${TEST_USER_ID}的记忆数据: ${userMemories.length}条`);
    
    if (userMemories.length === 0) {
      log("没有找到记忆数据，退出脚本");
      return;
    }
    
    // 处理每条记忆的向量嵌入
    let updatedCount = 0;
    let missingCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const memory of userMemories) {
      try {
        // 获取当前记忆的向量嵌入
        const embedding = await storage.getEmbeddingByMemoryId(memory.id);
        
        if (!embedding) {
          log(`记忆ID=${memory.id}没有向量嵌入，跳过`);
          missingCount++;
          continue;
        }
        
        // 检查向量维度
        const vectorData = embedding.vectorData;
        if (!Array.isArray(vectorData)) {
          log(`记忆ID=${memory.id}的向量数据无效，跳过`);
          missingCount++;
          continue;
        }
        
        const currentDimension = vectorData.length;
        
        // 如果已经是目标维度，跳过
        if (currentDimension === TARGET_DIMENSION) {
          log(`记忆ID=${memory.id}的向量已经是${TARGET_DIMENSION}维，无需修复`);
          alreadyCorrectCount++;
          continue;
        }
        
        log(`记忆ID=${memory.id}的向量维度为${currentDimension}，需要扩展到${TARGET_DIMENSION}维`);
        
        // 扩展向量到目标维度，保留原有值，其余填充0
        const extendedVector = [...vectorData];
        
        // 填充剩余维度为0
        while (extendedVector.length < TARGET_DIMENSION) {
          extendedVector.push(0);
        }
        
        // 更新数据库中的向量
        await db.update(memoryEmbeddings)
          .set({ vectorData: extendedVector })
          .where(eq(memoryEmbeddings.memoryId, memory.id));
        
        log(`成功将记忆ID=${memory.id}的向量维度从${currentDimension}扩展到${TARGET_DIMENSION}`);
        updatedCount++;
        
      } catch (error) {
        log(`处理记忆ID=${memory.id}时出错: ${error}`, "error");
      }
    }
    
    // 汇总结果
    log("\n==== 记忆向量维度修复完成 ====");
    log(`总记忆数: ${userMemories.length}`);
    log(`已修复记忆数: ${updatedCount}`);
    log(`已正确维度记忆数: ${alreadyCorrectCount}`);
    log(`缺失向量记忆数: ${missingCount}`);
    
  } catch (error) {
    log(`修复记忆向量维度时出错: ${error}`, "error");
  } finally {
    // 关闭数据库连接
    await pool.end();
  }
}

// 执行主函数
fixMemoryEmbeddingsDimension().catch(err => {
  log(`脚本执行失败: ${err}`, "error");
});