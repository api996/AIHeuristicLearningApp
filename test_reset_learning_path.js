/**
 * 测试脚本：重置学习轨迹缓存
 * 这个脚本会清除现有的学习轨迹缓存，并强制重新生成
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { db } from './server/db.js';
import { learning_paths } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// 测试用户ID
const TEST_USER_ID = 6;

// 主函数
async function resetLearningPath() {
  console.log('=== 重置学习轨迹缓存测试 ===');
  console.log(`为用户ID=${TEST_USER_ID}清除学习轨迹缓存...`);

  try {
    // 1. 直接从数据库删除学习轨迹
    const deleteResult = await db.delete(learning_paths)
      .where(eq(learning_paths.userId, TEST_USER_ID))
      .returning();
    
    console.log(`删除结果: ${deleteResult.length}条记录已删除`);
    
    // 2. 调用API强制刷新学习轨迹
    console.log('调用API强制刷新学习轨迹...');
    exec(`curl -s -X POST http://localhost:5000/api/learning-path/${TEST_USER_ID}/refresh -H "Content-Type: application/json"`, 
      (error, stdout, stderr) => {
        if (error) {
          console.error(`执行curl命令时出错: ${error}`);
          return;
        }
        
        console.log('API响应:');
        try {
          // 尝试格式化JSON输出
          const response = JSON.parse(stdout);
          console.log(JSON.stringify(response, null, 2));
          
          // 检查是否包含分布数据
          if (response && response.distribution) {
            console.log('\n分布数据:');
            console.log(JSON.stringify(response.distribution, null, 2));
          }
        } catch (parseError) {
          // 如果不是有效的JSON，直接输出原始响应
          console.log(stdout);
        }
        
        if (stderr) {
          console.error(`curl命令stderr: ${stderr}`);
        }
        
        // 3. 获取并显示新的学习轨迹
        setTimeout(() => {
          exec(`curl -s "http://localhost:5000/api/learning-path?userId=${TEST_USER_ID}"`, 
            (error2, stdout2, stderr2) => {
              if (error2) {
                console.error(`获取学习轨迹时出错: ${error2}`);
                return;
              }
              
              console.log('\n获取到的学习轨迹:');
              try {
                // 尝试解析JSON并提取重要部分
                const pathData = JSON.parse(stdout2);
                
                // 只显示主题和分布
                const summary = {
                  topics: pathData.topics.map(t => ({ id: t.id, topic: t.topic, percentage: t.percentage })),
                  distribution: pathData.distribution
                };
                
                console.log(JSON.stringify(summary, null, 2));
                
                // 专门检查distribution字段
                console.log('\n分布数据中的主题名称:');
                
                pathData.distribution.forEach(item => {
                  const topicName = item.name || item.topic || '未知主题';
                  console.log(`- ID: ${item.id}, 名称: ${topicName}, 百分比: ${item.percentage}%`);
                });
                
                console.log('\n测试完成!');
              } catch (parseError2) {
                console.log(stdout2);
              }
              
              if (stderr2) {
                console.error(`获取学习轨迹stderr: ${stderr2}`);
              }
              
              // 测试完成后关闭数据库连接
              setTimeout(() => {
                // 延迟一点关闭数据库连接
                process.exit(0);
              }, 500);
            });
        }, 2000); // 等待2秒后获取新数据
      }
    );
  } catch (error) {
    console.error(`执行测试时出错: ${error}`);
    process.exit(1);
  }
}

// 执行主函数
resetLearningPath();