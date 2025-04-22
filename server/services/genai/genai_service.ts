/**
 * 通用人工智能服务接口
 * 提供向量嵌入生成、文本总结等功能
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Create a simple logger that doesn't depend on vite.ts
const log = (message: string, source = "genai_service") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
};

/**
 * 此函数已被禁用，不再用于过滤AI响应中的"思考过程"内容
 * @deprecated 此函数已不再使用，保留是为了兼容性
 * @param text 原始AI响应文本
 * @returns 未经修改的原始文本
 */
export function removeThinkingProcess(text: string): string {
  // 函数已被禁用，直接返回原始文本
  log(`removeThinkingProcess函数已被禁用，直接返回原始响应文本`);
  return text;
}

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
      // 与Python服务保持一致，使用实验性嵌入模型
      // 注意：此处应当始终与server/services/embedding.py中的模型保持一致
      // 目前Python模型使用："models/gemini-embedding-exp-03-07"
      // 但Google JS SDK可能需要不同的模型名称格式
      const model = this.genAI.getGenerativeModel({ model: "embedding-001" });
      // TODO: 更新JS SDK模型名称，匹配Python服务使用的gemini-embedding-exp-03-07
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
      
      // 使用Gemini 1.5 Flash模型生成摘要
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 使用正确的消息结构
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `请为以下文本生成一个简洁的摘要（不超过50个字）:\n\n${truncatedText}` }]
        }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 100
        }
      });
      
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
      
      // 使用Gemini 1.5 Flash模型提取关键词
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 使用正确的消息结构
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: `请从以下文本中提取5到10个关键词或短语，以逗号分隔。这些关键词应该能够概括文本的主要内容和主题:\n\n${truncatedText}` }]
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 200
        }
      });
      
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
      // 使用最多5个文本样本，并限制每个样本长度以避免超过令牌限制
      const sampleTexts = texts.slice(0, 5).map(text => text.substring(0, 4000));
      const combinedText = sampleTexts.join("\n---\n").substring(0, 20000);
      
      // 使用Gemini 1.5 Flash模型生成主题（更快速的模型版本）
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 改进的提示词，给出更明确的指导和更多上下文
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 
            `以下是一组相关的用户学习记忆或对话内容。请分析这些内容，识别它们的共同主题，并生成一个简洁、有意义的主题标签。

主题标签要求:
1. 长度在2-6个词之间（或5-15个字符）
2. 具体而非抽象（例如："机器学习算法"而不是"学习"）
3. 内容相关而非格式相关
4. 避免使用"主题"、"学习"等通用词作为标签的主要部分
5. 使用学科领域的专业术语，但应保持易理解
6. 应反映内容的实质而非表面形式

内容样本:
${combinedText}

请直接输出主题标签，不要有任何解释或引号。` 
          }]
        }],
        generationConfig: {
          temperature: 0.2,  // 降低温度以获得更稳定的结果
          topP: 0.85,
          topK: 40,
          maxOutputTokens: 50
        }
      });
      
      // 清理结果
      let topic = result.response.text().trim();
      
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
    // 生成一个随机向量作为后备，使用3072维度以匹配高质量文本嵌入
    log("[genai_service] 使用3072维随机向量作为后备嵌入", "warn");
    return Array.from({ length: 3072 }, () => (Math.random() * 2 - 1) * 0.01);
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
    const commonWords = new Set<string>(["的", "是", "在", "了", "和", "有", "与", "又", "也", "the", "is", "a", "an", "of", "to", "in", "for"]);
    
    // 简单分词，取非常见的词作为关键词
    const words = text.split(/[\s,，.。:：;；!！?？、]+/).filter(w => 
      w.length >= 2 && w.length <= 10 && !commonWords.has(w.toLowerCase())
    );
    
    // 去重并限制数量
    const uniqueWords = Array.from(new Set(words)).slice(0, 8);
    return uniqueWords.length > 0 ? uniqueWords : ["未知主题"];
  }

  async generateTopicForMemories(texts: string[]): Promise<string | null> {
    // 尝试从文本中提取第一个关键词作为主题
    log("[genai_service] 使用简单关键词作为后备主题生成", "warn");
    const keywords = await this.extractKeywords(texts.join(" "));
    return keywords && keywords.length > 0 ? keywords[0] : "记忆集合";
  }
}

/**
 * 创建服务实例的异步函数
 * 返回Promise以避免TypeScript错误
 */
const createGenAIService = async (): Promise<GenAIService> => {
  // 首先尝试使用Gemini服务
  const geminiService = new GeminiService();
  
  try {
    // 测试API是否可用
    const result = await geminiService.generateEmbedding("测试");
    if (result) {
      log("[genai_service] GenAI 服务已初始化", "info");
      return geminiService;
    } else {
      log("[genai_service] API测试返回空结果，使用后备服务", "warn");
      return new FallbackService();
    }
  } catch (error) {
    log("[genai_service] API测试失败，使用后备服务", "warn");
    return new FallbackService();
  }
};

// 导出服务实例
export let genAiService: GenAIService = new FallbackService();

// 异步初始化
(async () => {
  try {
    genAiService = await createGenAIService();
  } catch (error) {
    log(`[genai_service] 初始化失败，使用后备服务: ${error}`, "error");
    // 保持使用默认的后备服务
  }
})();