/**
 * 直接调用嵌入服务脚本
 * 通过HTTP调用而不是生成子进程
 */

import axios from 'axios';

/**
 * 直接使用HTTP调用嵌入服务
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.log('无法为空文本生成嵌入');
    return null;
  }

  try {
    // 清理文本，移除多余空白并截断
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    const truncatedText = cleanedText.length > 8000 
      ? cleanedText.substring(0, 8000)
      : cleanedText;
    
    console.log('使用HTTP调用嵌入服务生成语义向量嵌入');
    
    // 使用环境中百度向量服务
    // 使用Gemini API生成嵌入向量
    
    // 调用Gemini API服务
    const response = await axios.post('http://localhost:5000/api/embed', {
      text: truncatedText
    });
    
    // 验证响应
    if (response.status !== 200 || !response.data || !response.data.embedding) {
      console.error('嵌入服务返回错误响应:', response.status, response.data);
      return null;
    }
    
    const embedding = response.data.embedding;
    
    // 验证维度
    if (embedding.length !== 3072) {
      console.error(`警告: 嵌入维度异常 (${embedding.length}), 期望为3072维`);
      return null;
    }
    
    console.log(`成功生成${embedding.length}维语义向量嵌入`);
    return embedding;
    
  } catch (error) {
    console.error(`生成嵌入时出错: ${error.message}`);
    return null;
  }
}