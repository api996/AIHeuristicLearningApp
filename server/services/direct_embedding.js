/**
 * 直接调用嵌入服务脚本
 * 直接使用genai_service而不是通过HTTP调用
 */

import { genAiService } from './genai/genai_service';

/**
 * 直接使用genAiService生成嵌入向量
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
    
    console.log('使用Gemini API生成语义向量嵌入');
    
    // 直接使用genAiService生成嵌入向量
    const embedding = await genAiService.generateEmbedding(truncatedText);
    
    // 验证嵌入向量
    if (!embedding) {
      console.error('生成嵌入失败，返回空值');
      return null;
    }
    
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