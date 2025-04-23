/**
 * 清理内存向量数据脚本
 * 
 * 本脚本会：
 * 1. 识别并删除无效向量（大量维度为零的向量）
 * 2. 报告清理结果
 */

import { db } from "../server/db";
import { eq, sql, isNull, and } from "drizzle-orm";
import { memoryEmbeddings, memories } from "../shared/schema";
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 定义判断无效向量的标准
const ZERO_THRESHOLD = 0.9; // 如果90%以上的维度接近零，则认为是无效向量

/**
 * 判断向量是否为低质量向量（大部分维度接近零）
 * @param vector 向量数组
 * @returns 是否为低质量向量
 */
function isLowQualityVector(vector: number[]): boolean {
  if (!vector || !Array.isArray(vector)) return true;
  
  // 计算接近零的元素数量
  let zeroCount = 0;
  for (const value of vector) {
    if (Math.abs(value) < 0.00001) {
      zeroCount++;
    }
  }
  
  // 计算零元素占比
  const zeroRatio = zeroCount / vector.length;
  return zeroRatio >= ZERO_THRESHOLD;
}

/**
 * 清理数据库中的低质量向量
 */
async function cleanLowQualityVectors() {
  try {
    console.log("开始清理低质量向量数据...");
    
    // 获取所有向量数据
    const allEmbeddings = await db.select()
      .from(memoryEmbeddings)
      .where(sql`vector_data IS NOT NULL`);
    
    console.log(`共找到 ${allEmbeddings.length} 条向量数据`);
    
    // 识别低质量向量
    const lowQualityIds: string[] = [];
    
    for (const embedding of allEmbeddings) {
      // vectorData 是 JSON 类型，需要转换为数组
      const vector = embedding.vectorData as number[];
      if (isLowQualityVector(vector)) {
        lowQualityIds.push(embedding.memoryId);
      }
    }
    
    console.log(`发现 ${lowQualityIds.length} 条低质量向量数据`);
    
    // 删除低质量向量
    if (lowQualityIds.length > 0) {
      for (const id of lowQualityIds) {
        // 使用ORM删除，直接链式调用
        await db.delete(memoryEmbeddings)
          .where(eq(memoryEmbeddings.memoryId, id))
          .execute();
        
        console.log(`已删除记忆ID为 ${id} 的低质量向量`);
      }
      
      console.log(`成功删除 ${lowQualityIds.length} 条低质量向量数据`);
    } else {
      console.log("未发现低质量向量数据，无需清理");
    }
    
    // 检查没有向量的记忆
    const memoriesWithoutVectors = await db.select({ id: memories.id })
      .from(memories)
      .leftJoin(
        memoryEmbeddings, 
        eq(memories.id, memoryEmbeddings.memoryId)
      )
      .where(isNull(memoryEmbeddings.memoryId));
    
    console.log(`发现 ${memoriesWithoutVectors.length} 条记忆没有对应的向量数据`);
    
    console.log("清理操作完成");
  } catch (error) {
    console.error("清理低质量向量时出错:", error);
  } finally {
    // 关闭数据库连接池
    try {
      // 直接导入pool对象
      const { pool } = await import('../server/db');
      if (pool && typeof pool.end === 'function') {
        await pool.end();
        console.log("数据库连接池已关闭");
      }
    } catch (e) {
      console.log("关闭数据库连接时出错:", e);
    }
  }
}

// 执行清理操作
cleanLowQualityVectors().catch(console.error);