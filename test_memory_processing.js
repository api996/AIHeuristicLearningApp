// 测试脚本：检查用户7的学习轨迹生成
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 这个函数使用和trajectory.ts中相同的关键词提取逻辑
function extractKeywords(content) {
  if (!content) return [];
  
  const stopWords = ["的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说"];
  
  // 简单分词
  const words = content.split(/\s+/).filter(word => 
    word.length > 1 && !stopWords.includes(word)
  );
  
  // 返回前5个关键词
  return words.slice(0, 5);
}

// 读取用户7的记忆文件
function readUser7Memories() {
  const memories = [];
  const user7Dir = path.join(process.cwd(), 'memory_space', '7');
  
  if (!fs.existsSync(user7Dir)) {
    console.log('用户7的记忆目录不存在');
    return memories;
  }
  
  const files = fs.readdirSync(user7Dir).filter(f => f.endsWith('.json'));
  console.log(`找到${files.length}个记忆文件`);
  
  files.forEach(file => {
    try {
      const filePath = path.join(user7Dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const memoryData = JSON.parse(content);
      memories.push(memoryData);
    } catch (err) {
      console.error(`读取文件 ${file} 出错: ${err.message}`);
    }
  });
  
  return memories;
}

// 分析记忆内容生成主题
function analyzeMemories(memories) {
  // 获取记忆内容的主要关键词
  const keywords = memories.flatMap(memory => {
    // 简单提取记忆内容中的主要词汇
    const content = memory.content || "";
    return extractKeywords(content);
  });
  
  console.log('提取的关键词:', keywords);
  
  // 计算关键词频率
  const keywordFreq = {};
  keywords.forEach(keyword => {
    keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
  });
  
  // 按频率排序
  const sortedKeywords = Object.entries(keywordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3); // 取前3个关键词作为主题
  
  console.log('关键词频率:', sortedKeywords);
  
  // 如果能够提取到有意义的关键词，生成主题
  if (sortedKeywords.length > 0) {
    const topics = sortedKeywords.map(([keyword, count], index) => {
      const topicName = keyword.length > 1 ? `${keyword}相关` : "对话主题";
      return {
        topic: topicName,
        id: `topic_${index}`,
        count: count,
        percentage: Math.min(95, 30 + index * 10 + Math.floor(Math.random() * 10))
      };
    });
    
    console.log('生成的主题:', topics);
    return topics;
  } else {
    console.log('未能从记忆中提取有效关键词，将使用默认主题');
    return [
      {topic: "对话主题", id: "topic_conversation", count: 1, percentage: 40},
      {topic: "问答交流", id: "topic_qa", count: 1, percentage: 30}
    ];
  }
}

// 主函数
function main() {
  console.log('开始分析用户7的记忆文件...');
  const memories = readUser7Memories();
  
  if (memories.length === 0) {
    console.log('未找到用户7的记忆文件，无法生成学习轨迹');
    return;
  }
  
  console.log(`找到${memories.length}条记忆，内容摘要:`);
  memories.forEach((m, i) => {
    console.log(`记忆 ${i+1}: ${m.content.substring(0, 50)}...`);
  });
  
  // 分析记忆生成主题
  const topics = analyzeMemories(memories);
  
  // 查看修改后的逻辑是否会生成正确的主题，而不是硬编码的"英语学习"
  console.log('\n========= 最终分析结果 =========');
  console.log('生成的主题:');
  console.log(JSON.stringify(topics, null, 2));
  console.log('对比: 之前的硬编码主题是"英语学习"、"编程技术"等');
}

// 运行测试
main();