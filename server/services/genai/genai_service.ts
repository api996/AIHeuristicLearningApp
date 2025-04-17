/**
 * 通用人工智能服务接口
 * 提供向量嵌入生成、文本总结等功能
 */

import { log } from "../../vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 导入环境变量配置
let geminiApiKey = process.env.GEMINI_API_KEY || "";

export interface GenAIService {
  /**
   * 生成文本的向量嵌入
   * @param text 输入文本
   * @returns 向量嵌入数组
   */
  generateEmbedding(text: string): Promise<number[] | null>;

  /**
   * 生成文本摘要
   * @param text 输入文本
   * @returns 文本摘要
   */
  generateSummary(text: string): Promise<string | null>;

  /**
   * 从文本中提取关键词
   * @param text 输入文本
   * @returns 关键词数组
   */
  extractKeywords(text: string): Promise<string[] | null>;

  /**
   * 为一组记忆生成主题标签
   * @param texts 文本数组
   * @returns 主题标签
   */
  generateTopicForMemories(texts: string[]): Promise<string | null>;
}

/**
 * Google Gemini AI服务实现
 */
class GeminiService implements GenAIService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    this.initializeAPI();
  }

  private initializeAPI() {
    try {
      if (!geminiApiKey) {
        log("[genai_service] 警告: GEMINI_API_KEY未设置，某些功能将不可用", "warn");
        return;
      }

      this.genAI = new GoogleGenerativeAI(geminiApiKey);
      log("[genai_service] Gemini AI API初始化成功", "info");
    } catch (error) {
      log(`[genai_service] Gemini AI API初始化失败: ${error}`, "error");
      this.genAI = null;
    }
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.genAI) {
      log("[genai_service] 无法生成嵌入: API未初始化", "warn");
      return null;
    }

    try {
      // Gemini API的嵌入模型
      const model = this.genAI.getGenerativeModel({ model: "embedding-001" });
      // 生成嵌入
      const result = await model.embedContent(text);
      const embedding = result.embedding.values;
      return embedding;
    } catch (error) {
      log(`[genai_service] 生成嵌入失败: ${error}`, "error");
      return null;
    }
  }

  async generateSummary(text: string): Promise<string | null> {
    if (!this.genAI) {
      log("[genai_service] 无法生成摘要: API未初始化", "warn");
      return null;
    }

    try {
      // 截断文本，防止过长
      const truncatedText = text.length > 15000 ? text.substring(0, 15000) + "..." : text;
      
      // 使用Gemini模型生成摘要
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `请为以下文本生成一个简洁的摘要（不超过50个字）:\n\n${truncatedText}`;
      
      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim();
      
      // 确保摘要不超过数据库字段长度限制
      return summary.length > 255 ? summary.substring(0, 252) + "..." : summary;
    } catch (error) {
      log(`[genai_service] 生成摘要失败: ${error}`, "error");
      return null;
    }
  }

  async extractKeywords(text: string): Promise<string[] | null> {
    if (!this.genAI) {
      log("[genai_service] 无法提取关键词: API未初始化", "warn");
      return null;
    }

    try {
      // 截断文本，防止过长
      const truncatedText = text.length > 10000 ? text.substring(0, 10000) + "..." : text;
      
      // 使用Gemini模型提取关键词
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `请从以下文本中提取5到10个关键词或短语，以逗号分隔。这些关键词应该能够概括文本的主要内容和主题:\n\n${truncatedText}`;
      
      const result = await model.generateContent(prompt);
      const keywordsText = result.response.text().trim();
      
      // 解析关键词（假设返回的是逗号分隔的关键词）
      const keywords = keywordsText
        .split(/[,，、]/)  // 支持中英文分隔符
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0 && kw.length < 50); // 过滤空值和过长的关键词
      
      return keywords.length > 0 ? keywords : null;
    } catch (error) {
      log(`[genai_service] 提取关键词失败: ${error}`, "error");
      return null;
    }
  }

  async generateTopicForMemories(texts: string[]): Promise<string | null> {
    if (!this.genAI) {
      log("[genai_service] 无法生成主题: API未初始化", "warn");
      return null;
    }

    try {
      // 合并并截断文本，防止过长
      const combinedText = texts.join("\n\n").substring(0, 20000);
      
      // 使用Gemini模型生成主题
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `请为以下一组相关文本生成一个简洁的主题标签（5-10个字）。这个标签应该能够概括这组文本的共同主题:\n\n${combinedText}`;
      
      const result = await model.generateContent(prompt);
      const topic = result.response.text().trim();
      
      // 进一步处理，确保主题简洁
      let cleanTopic = topic.replace(/["'"【】《》]/g, ""); // 移除引号和括号
      cleanTopic = cleanTopic.split(/[\n\r\t]/)[0]; // 只取第一行
      
      return cleanTopic.length > 100 ? cleanTopic.substring(0, 97) + "..." : cleanTopic;
    } catch (error) {
      log(`[genai_service] 生成主题失败: ${error}`, "error");
      return null;
    }
  }
}

/**
 * 后备服务实现（当API不可用时）
 */
class FallbackService implements GenAIService {
  async generateEmbedding(text: string): Promise<number[] | null> {
    // 生成一个随机向量作为后备
    log("[genai_service] 使用随机向量作为后备嵌入", "warn");
    return Array.from({ length: 768 }, () => (Math.random() * 2 - 1) * 0.01);
  }

  async generateSummary(text: string): Promise<string | null> {
    // 使用文本的前50个字符作为摘要
    const truncatedText = text.substring(0, 50).trim();
    log("[genai_service] 使用文本截断作为后备摘要", "warn");
    return truncatedText.length > 0 ? truncatedText + "..." : "无内容摘要";
  }

  async extractKeywords(text: string): Promise<string[] | null> {
    // 简单提取一些常见词作为关键词
    log("[genai_service] 使用简单分词作为后备关键词提取", "warn");
    const commonWords = new Set(["的", "是", "在", "了", "和", "有", "与", "又", "也", "the", "is", "a", "an", "of", "to", "in", "for"]);
    
    // 简单分词，取非常见的词作为关键词
    const words = text.split(/[\s,，.。:：;；!！?？、]+/).filter(w => 
      w.length >= 2 && w.length <= 10 && !commonWords.has(w.toLowerCase())
    );
    
    // 去重并限制数量
    const uniqueWords = [...new Set(words)].slice(0, 8);
    return uniqueWords.length > 0 ? uniqueWords : ["未知主题"];
  }

  async generateTopicForMemories(texts: string[]): Promise<string | null> {
    // 尝试从文本中提取第一个关键词作为主题
    log("[genai_service] 使用简单关键词作为后备主题生成", "warn");
    const keywords = await this.extractKeywords(texts.join(" "));
    return keywords && keywords.length > 0 ? keywords[0] : "记忆集合";
  }
}

// 创建服务实例
const createGenAIService = (): GenAIService => {
  // 首先尝试使用Gemini服务
  const geminiService = new GeminiService();
  
  // 测试API是否可用
  return geminiService.generateEmbedding("测试").then(result => {
    if (result) {
      log("[genai_service] GenAI 服务已初始化", "info");
      return geminiService;
    } else {
      log("[genai_service] 使用后备服务", "warn");
      return new FallbackService();
    }
  }).catch(() => {
    log("[genai_service] API测试失败，使用后备服务", "warn");
    return new FallbackService();
  });
};

// 导出服务实例
export let genAiService: GenAIService;

// 异步初始化
createGenAIService().then(service => {
  genAiService = service;
});

// 默认使用后备服务，直到异步初始化完成
genAiService = new FallbackService();