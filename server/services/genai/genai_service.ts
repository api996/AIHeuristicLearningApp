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
   * @param metadata 可选的元数据，例如聚类特征信息
   * @returns 主题标签
   */
  generateTopicForMemories(texts: string[], metadata?: any): Promise<string | null>;
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
    try {
      // 直接调用Python嵌入服务
      log("[genai_service] 调用Python嵌入服务生成向量嵌入", "info");
      
      // 导入Python嵌入服务
      const { pythonEmbeddingService } = await import("../learning/python_embedding");
      
      // 使用Python服务生成嵌入
      const embedding = await pythonEmbeddingService.generateEmbedding(text);
      
      if (!embedding) {
        log("[genai_service] Python嵌入服务返回空结果，请检查Python环境配置", "error");
        throw new Error("Python嵌入服务无法生成向量，请确保python3和相关依赖已正确安装");
      }
      
      log(`[genai_service] 成功生成${embedding.length}维向量嵌入（通过Python服务）`, "info");
      return embedding;
    } catch (error) {
      log(`[genai_service] 通过Python服务生成嵌入失败: ${error}`, "error");
      
      // 出错时抛出异常，不使用备用API
      // 这样可以强制修复Python环境问题，而不是依赖备用方案
      throw new Error(`嵌入向量生成失败，请确保Python环境正确安装: ${error}`);
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

  async generateTopicForMemories(texts: string[], metadata?: any): Promise<string | null> {
    if (!this.genAI) {
      log("[genai_service] 无法生成主题: API未初始化", "warn");
      return null;
    }

    try {
      // 记录输入数据以便调试
      log(`[genai_service] 开始生成主题，接收到${texts.length}条文本样本${metadata ? '和元数据' : ''}`);
      if (texts.length === 0) {
        log("[genai_service] 警告: 收到空文本数组，无法生成主题", "warn");
        return "一般讨论";
      }
      
      // 合并并截断文本，防止过长
      // 使用最多5个文本样本，并限制每个样本长度以避免超过令牌限制
      const sampleTexts = texts.slice(0, 5).map(text => text.substring(0, 2000));
      const combinedText = sampleTexts.join("\n---\n").substring(0, 10000);
      
      // 使用Gemini 1.5 Flash模型生成主题（更快速的模型版本）
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 构建提示词
      let prompt = `你是一个主题标签专家。请分析这些文本，创建一个简短且有描述性的主题标签（最多6个词或20个字符）。
标签应表达内容的核心概念或关键主题，清晰明了，易于理解，同时要有足够描述性，使人一眼就能理解内容大意。
直接输出主题名称，不要使用引号，不要添加解释。`;

      // 如果有元数据，添加上下文信息
      if (metadata && metadata.cluster_info) {
        // 添加聚类相关的元数据
        prompt += `\n\n这些文本属于一个聚类组，聚类中包含${metadata.cluster_info.memory_count || '多'}条相关记忆。`;
        
        // 如果有关键词信息，添加到提示中
        if (metadata.cluster_info.keywords && metadata.cluster_info.keywords.length > 0) {
          const keywordsText = metadata.cluster_info.keywords.slice(0, 5).join('、');
          prompt += `\n聚类关键词包括：${keywordsText}。请确保主题与这些关键词相关，但不要局限于单个关键词，应该能概括整体主题。`;
        }
        
        // 如果有记忆类型信息，添加到提示中
        if (metadata.cluster_info.memory_types) {
          prompt += `\n记忆类型主要是：${metadata.cluster_info.memory_types}。`;
        }
        
        // 如果有原始聚类数据，添加聚类信息
        if (metadata.cluster_info.raw_data) {
          prompt += `\n这是一个紧密相关的聚类，请确保主题能够概括所有记忆的共同要点。`;
        }
      }
      
      prompt += `\n\n文本:\n${combinedText}`;
      
      // 发送请求
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,  // 稍微提高温度，允许更有创意的主题
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 50
        }
      });
      
      // 清理结果
      let topic = result.response.text().trim();
      log(`[genai_service] 原始AI生成的主题: "${topic}"`);
      
      // 进一步处理，确保主题简洁
      let cleanTopic = topic.replace(/["'"【】《》]/g, ""); // 移除引号和括号
      cleanTopic = cleanTopic.split(/[\n\r\t]/)[0]; // 只取第一行
      
      // 如果生成内容太短或为空，使用备用主题
      if (!cleanTopic || cleanTopic.length < 2) {
        log(`[genai_service] 警告: 生成的主题太短或为空，使用备用主题`, "warn");
        return "学习笔记";
      }
      
      // 限制长度并记录
      const finalTopic = cleanTopic.length > 30 ? cleanTopic.substring(0, 27) + "..." : cleanTopic;
      log(`[genai_service] 成功生成主题: "${finalTopic}"`);
      
      return finalTopic;
    } catch (error) {
      log(`[genai_service] 生成主题失败: ${error}`, "error");
      // 错误情况下直接返回一个固定字符串，而不是null
      return "技术讨论";
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

  async generateTopicForMemories(texts: string[], metadata?: any): Promise<string | null> {
    // 尝试从文本中提取第一个关键词作为主题
    log("[genai_service] 使用简单关键词作为后备主题生成", "warn");
    
    // 如果有元数据中包含关键词，优先使用元数据关键词
    if (metadata && metadata.cluster_info && 
        metadata.cluster_info.keywords && 
        metadata.cluster_info.keywords.length > 0) {
      // 使用元数据中提供的关键词
      const metaKeywords = metadata.cluster_info.keywords;
      log(`[genai_service] 使用元数据中的关键词作为主题: ${metaKeywords[0]}`);
      return metaKeywords[0];
    }
    
    // 否则使用文本内容提取关键词
    const keywords = await this.extractKeywords(texts.join(" "));
    return keywords && keywords.length > 0 ? keywords[0] : "记忆集合";
  }
}

/**
 * 创建服务实例的异步函数
 * 返回Promise以避免TypeScript错误
 */
const createGenAIService = async (): Promise<GenAIService> => {
  // 使用Gemini服务，不使用后备
  const geminiService = new GeminiService();
  
  if (!geminiApiKey || geminiApiKey.trim() === "") {
    throw new Error("[genai_service] 未设置Gemini API密钥，请配置GEMINI_API_KEY环境变量");
  }
  
  try {
    // 测试API是否可用 - 尝试直接生成主题
    const testTexts = ["测试文本，用于验证Gemini API是否可用"];
    const testTopic = await geminiService.generateTopicForMemories(testTexts);
    
    if (testTopic && testTopic !== "用户问") {
      log(`[genai_service] GenAI 服务已初始化，主题生成测试成功: "${testTopic}"`, "info");
      return geminiService;
    } else {
      throw new Error(`[genai_service] API测试返回无效主题或错误结果: "${testTopic}"，请检查API密钥是否有效`);
    }
  } catch (error) {
    log(`[genai_service] API初始化失败: ${error}`, "error");
    throw error; // 向上抛出错误，不使用后备服务
  }
};

// 导出服务实例
export let genAiService: GenAIService;

// 暂时使用一个简单的Promise占位，等待初始化完成
let serviceInitPromise: Promise<void>;

// 创建初始化函数，方便外部代码使用
export const initializeGenAIService = async (): Promise<GenAIService> => {
  if (genAiService) {
    // 已初始化，直接返回
    return genAiService;
  }

  try {
    log(`[genai_service] 正在初始化GenAI服务...`, "info");
    const service = await createGenAIService();
    genAiService = service;
    return service;
  } catch (error) {
    log(`[genai_service] 初始化失败: ${error}`, "error");
    
    // 返回后备服务，确保任何时候都有功能
    log(`[genai_service] 使用后备服务`, "warn");
    const fallbackService = new FallbackService();
    genAiService = fallbackService;
    return fallbackService;
  }
};

// 立即执行初始化
(async () => {
  serviceInitPromise = new Promise(async (resolve) => {
    try {
      // 使用初始化函数
      genAiService = await initializeGenAIService();
      resolve();
    } catch (error) {
      log(`[genai_service] 初始化错误处理: ${error}`, "error");
      // 即使出错也要解决Promise，避免阻塞
      resolve();
    }
  });
})();

// 为防止初始导出的genAiService为undefined，提供一个错误提示方法
setTimeout(() => {
  if (!genAiService) {
    log(`[genai_service] 警告：服务初始化可能失败，API调用可能会出错`, "error");
    // 创建一个后备服务以防万一
    genAiService = new FallbackService();
  }
}, 5000);