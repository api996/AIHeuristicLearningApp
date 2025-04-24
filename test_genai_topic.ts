/**
 * GenAI主题生成测试脚本
 * 测试优化后的主题生成功能
 */

// 导入所需的模块
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 设置一个简单的日志函数
function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

// 测试函数
async function testGenAITopicGeneration(): Promise<void> {
  try {
    colorLog('开始测试GenAI主题生成功能...', 'info');
    
    // 创建一个自定义的GenAI服务实例，以便测试
    // 导入GoogleGenerativeAI
    const GoogleGenerativeAI = await import('@google/generative-ai');
    
    // 导入GenAIService类型定义
    const { GeminiService } = await import('./server/services/genai/genai_service.js');
    
    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 准备测试数据
    const testTexts = [
      "今天我们讨论了机器学习的基础概念，包括监督学习和无监督学习。讨论了如何选择合适的算法来解决不同类型的问题。",
      "梯度下降是一种优化算法，用于最小化损失函数。我们还讨论了随机梯度下降和批量梯度下降的区别。",
      "神经网络是机器学习的一个子领域，它模拟了人脑的工作方式。我们讨论了不同类型的神经网络架构。"
    ];
    
    // 准备元数据
    const metadata = {
      cluster_info: {
        cluster_id: 'test_cluster_1',
        memory_count: 3,
        memory_types: '对话记忆',
        keywords: ['机器学习', '神经网络', '梯度下降', '算法', '优化']
      }
    };
    
    // 1. 不带元数据的主题生成
    colorLog('1. 测试普通主题生成(无元数据)...', 'info');
    const basicTopic = await genAiService.generateTopicForMemories(testTexts);
    colorLog(`生成的基本主题: "${basicTopic}"`, 'success');
    
    // 2. 带元数据的主题生成
    colorLog('2. 测试增强主题生成(带元数据)...', 'info');
    const enhancedTopic = await genAiService.generateTopicForMemories(testTexts, metadata);
    colorLog(`生成的增强主题: "${enhancedTopic}"`, 'success');
    
    // 3. 多样本测试
    colorLog('3. 使用不同样本进行对比测试...', 'info');
    
    // 测试样本2 - 编程相关
    const programmingTexts = [
      "今天我们讨论了React的组件生命周期，以及如何使用useState和useEffect钩子。",
      "函数式编程和面向对象编程各有其优缺点，取决于你要解决的问题。",
      "Git是一个分布式版本控制系统，可以帮助团队协作开发软件。"
    ];
    
    // 不带元数据
    const basicProgrammingTopic = await genAiService.generateTopicForMemories(programmingTexts);
    colorLog(`编程内容基本主题: "${basicProgrammingTopic}"`, 'success');
    
    // 带元数据
    const programmingMetadata = {
      cluster_info: {
        cluster_id: 'test_cluster_2',
        memory_count: 3,
        memory_types: '对话记忆',
        keywords: ['React', '编程', 'Git', '钩子', '版本控制']
      }
    };
    
    const enhancedProgrammingTopic = await genAiService.generateTopicForMemories(programmingTexts, programmingMetadata);
    colorLog(`编程内容增强主题: "${enhancedProgrammingTopic}"`, 'success');
    
    // 汇总结果
    colorLog('\n测试结果汇总:', 'info');
    colorLog(`机器学习内容 - 基本主题: "${basicTopic}"`, 'info');
    colorLog(`机器学习内容 - 增强主题: "${enhancedTopic}"`, 'info');
    colorLog(`编程内容 - 基本主题: "${basicProgrammingTopic}"`, 'info');
    colorLog(`编程内容 - 增强主题: "${enhancedProgrammingTopic}"`, 'info');
    
    colorLog('\nGenAI主题生成测试完成!', 'success');
  } catch (error) {
    colorLog(`测试失败: ${error}`, 'error');
  }
}

// 运行测试
testGenAITopicGeneration();