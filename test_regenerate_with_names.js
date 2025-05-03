/**
 * 测试脚本：使用意义明确的主题名称重新生成学习轨迹
 * 这个脚本使用API刷新学习轨迹并使用有意义的主题名称
 */

import { exec } from 'child_process';

const TEST_USER_ID = 6; // 测试用户ID

// 调用特殊的API端点，强制重新生成有意义的主题名称
console.log(`为用户ID=${TEST_USER_ID}重新生成有意义的主题名称...`);

exec(`curl -s -X GET "http://localhost:5000/api/learning-path/${TEST_USER_ID}/regenerate-with-meaningful-names" -H "Content-Type: application/json"`, 
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
    } catch (parseError) {
      // 如果不是有效的JSON，直接输出原始响应
      console.log(stdout);
    }
    
    if (stderr) {
      console.error(`curl命令stderr: ${stderr}`);
    }
    
    // 获取并显示新的学习轨迹
    console.log('获取更新后的学习轨迹数据...');
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
            
            // 专门检查分布数据中的主题名称
            console.log('\n分布数据中的主题名称:');
            if (pathData && pathData.distribution) {
              pathData.distribution.forEach(item => {
                const topicName = item.name || item.topic || '未知主题';
                console.log(`- ID: ${item.id}, 名称: ${topicName}, 百分比: ${item.percentage}%`);
              });
            } else {
              console.log('未找到分布数据');
            }
            
            console.log('\n测试完成!');
          } catch (parseError2) {
            console.log('无法解析获取的学习轨迹数据:');
            console.log(stdout2);
          }
          
          if (stderr2) {
            console.error(`获取学习轨迹stderr: ${stderr2}`);
          }
        });
    }, 2000); // 等待2秒后获取新数据
  }
);