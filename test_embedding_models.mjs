/**
 * 测试Gemini可用的嵌入模型名称
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// API密钥
const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    // 初始化GoogleAI
    console.log('API_KEY length:', API_KEY ? API_KEY.length : 'missing');
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // 列出所有模型
    // 注意：在当前版本的JavaScript SDK中可能没有listModels方法
    // 这里直接使用axios调用API
    const axios = (await import('axios')).default;
    
    console.log('尝试获取所有可用模型...');
    const response = await axios.get(
      'https://generativelanguage.googleapis.com/v1/models',
      { params: { key: API_KEY } }
    );
    
    console.log('成功获取模型列表');
    const models = response.data.models || [];
    
    // 只显示与嵌入相关的模型
    const embeddingModels = models.filter(model => 
      model.name.toLowerCase().includes('embed') ||
      model.displayName.toLowerCase().includes('embed')
    );
    
    console.log('\n嵌入相关模型:');
    embeddingModels.forEach(model => {
      console.log(`\n模型名称: ${model.name}`);
      console.log(`显示名称: ${model.displayName}`);
      console.log(`支持的生成方法: ${model.supportedGenerationMethods.join(', ')}`);
      console.log(`版本: ${model.version}`);
    });
    
    // 测试嵌入模型是否可用
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    console.log('\n测试嵌入模型...');
    const result = await embeddingModel.embedContent("This is a test text for embedding generation.");
    console.log('嵌入生成成功，维度:', result.embedding.values.length);
    
  } catch (error) {
    console.error('错误:', error.message);
    if (error.response) {
      console.error('服务器响应:', error.response.data);
    }
  }
}

listModels();
