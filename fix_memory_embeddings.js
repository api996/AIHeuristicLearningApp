/**
 * 记忆向量嵌入修复脚本
 * 用于测试修复记忆向量嵌入的API
 */

import fetch from 'node-fetch';

async function fixMemoryEmbeddings(userId = 6) {
  try {
    console.log(`开始修复用户ID=${userId}的记忆向量嵌入...`);
    
    // 调用记忆修复API
    const response = await fetch(`http://localhost:5000/api/repair-memory?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('修复结果:', data);
    
    if (data.success) {
      console.log(`✅ 成功修复${data.repairedCount}条记忆数据`);
      
      // 测试修复后的学习轨迹数据
      console.log('获取学习轨迹数据...');
      const pathResponse = await fetch(`http://localhost:5000/api/learning-path?userId=${userId}`);
      const pathData = await pathResponse.json();
      
      if (pathData && pathData.nodes && pathData.nodes.length > 0) {
        console.log(`✅ 成功生成知识图谱: ${pathData.nodes.length}个节点, ${pathData.links.length}个连接`);
        console.log('主题分布:', pathData.topics);
      } else {
        console.log('❌ 知识图谱生成失败或数据不足');
      }
    } else {
      console.log('❌ 修复失败:', data.message);
    }
  } catch (error) {
    console.error('❌ 修复出错:', error);
  }
}

// 执行修复
fixMemoryEmbeddings();