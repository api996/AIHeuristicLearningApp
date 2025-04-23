/**
 * 通用人工智能服务接口
 * 提供向量嵌入生成、文本总结等功能
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { memories } from "@shared/schema";

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
   * 为聚类生成主题名称
   * @param memoryIds 记忆ID数组
   * @returns 聚类主题名称
   */
  generateClusterTopic(memoryIds: string[]): Promise<string | null>;

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
  
  /**
   * 标准化向量维度
   * @param vector 原始向量
   * @param targetDimension 目标维度
   * @returns 标准化后的向量
   */
  normalizeVectorDimension(vector: number[], targetDimension?: number): number[];
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

  /**
   * 标准化向量维度
   * 如果向量维度小于目标维度，通过重复向量内容进行扩展
   * 如果向量维度大于目标维度，通过截断进行缩减
   * 
   * @param vector 原始向量
   * @param targetDimension 目标维度，默认为3072
   * @returns 标准化后的向量
   */
  normalizeVectorDimension(vector: number[], targetDimension: number = 3072): number[] {
    if (!vector || vector.length === 0) {
      log("[genai_service] 无法标准化空向量", "error");
      return Array.from({ length: targetDimension }, () => 0);
    }
    
    const currentDimension = vector.length;
    
    // 如果已经是目标维度，直接返回
    if (currentDimension === targetDimension) {
      return vector;
    }
    
    log(`[genai_service] 标准化向量维度: ${currentDimension} -> ${targetDimension}`, "info");
    
    if (currentDimension < targetDimension) {
      // 通过重复向量内容扩展维度
      const repeats = Math.ceil(targetDimension / currentDimension);
      let extendedVector: number[] = [];
      
      for (let i = 0; i < repeats; i++) {
        extendedVector = extendedVector.concat(vector);
      }
      
      // 截断到目标维度
      const normalizedVector = extendedVector.slice(0, targetDimension);
      log(`[genai_service] 向量维度已扩展: ${currentDimension} -> ${normalizedVector.length}`, "info");
      return normalizedVector;
    } else {
      // 如果向量维度大于目标维度，截断为目标维度
      const normalizedVector = vector.slice(0, targetDimension);
      log(`[genai_service] 向量维度已截断: ${currentDimension} -> ${normalizedVector.length}`, "info");
      return normalizedVector;
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
        log("[genai_service] Python嵌入服务返回空结果", "warn");
        return null;
      }
      
      log(`[genai_service] 成功生成${embedding.length}维向量嵌入（通过Python服务）`, "info");
      
      // 标准化向量维度
      const normalizedEmbedding = this.normalizeVectorDimension(embedding);
      
      return normalizedEmbedding;
    } catch (error) {
      log(`[genai_service] 通过Python服务生成嵌入失败: ${error}`, "error");
      
      // 出错时尝试使用直接API调用（作为备用）
      if (this.genAI) {
        try {
          // 备用方案：直接使用JavaScript SDK
          log("[genai_service] 尝试使用备用JavaScript API", "warn");
          const modelName = "models/embedding-001";
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.embedContent(text);
          const embedding = result.embedding.values;
          log(`[genai_service] 备用API成功生成嵌入，维度: ${embedding.length}`, "info");
          
          // 标准化向量维度
          const normalizedEmbedding = this.normalizeVectorDimension(embedding);
          
          return normalizedEmbedding;
        } catch (fallbackError) {
          log(`[genai_service] 备用API也失败: ${fallbackError}`, "error");
          return null;
        }
      }
      
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
      
      // 全新重写的提示词，更精确更聚焦，强调专业术语提取
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: 
            `分析下列相关文本，提取它们讨论的核心学科主题或技术概念，并创建一个简洁专业的主题标签。

要求:
1. 长度限制：2-5个词或5-20个字符
2. 使用专业领域术语：如"量子计算"、"卷积神经网络"、"函数式编程"、"线性代数"
3. 专注真实学科主题：避免使用"学习"、"主题"、"分析"等通用词作为标签核心词
4. 专注内容而非格式：关注讨论了什么专业内容，而非"对话"、"问答"等
5. 具体而非抽象：使用精确术语，如"JavaScript闭包"而非"编程概念"
6. 直接输出主题标签：不要包含任何解释、思考过程或引号

文本:
${combinedText}

请直接输出主题标签，只有标签本身，不要思考过程，不要引号。
如果无法确定专业主题，输出"技术讨论"。` 
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

  /**
   * 为聚类生成主题名称
   * @param memoryIds 记忆ID数组
   * @returns 聚类主题名称
   */
  async generateClusterTopic(memoryIds: string[]): Promise<string | null> {
    if (!this.genAI) {
      log("[genai_service] 无法生成聚类主题: API未初始化", "warn");
      return null;
    }

    try {
      log(`[genai_service] 为聚类生成主题，ID数量: ${memoryIds.length}`);
      
      // 从数据库获取记忆内容
      const memoriesPromises = memoryIds.map(async (id) => {
        try {
          // 获取记忆详情
          const memory = await db.select().from(memories).where(eq(memories.id, id));
          return memory && memory.length > 0 ? memory[0].content : null;
        } catch (error) {
          log(`[genai_service] 获取记忆内容失败: ${error}`, "warn");
          return null;
        }
      });
      
      // 等待所有查询完成
      const contents = (await Promise.all(memoriesPromises))
        .filter(content => content !== null) as string[];
      
      // 如果没有找到有效内容，返回默认主题
      if (contents.length === 0) {
        log(`[genai_service] 聚类中没有找到有效记忆内容`, "warn");
        return "未分类内容";
      }
      
      // 使用现有的主题生成方法
      return this.generateTopicForMemories(contents);
    } catch (error) {
      log(`[genai_service] 生成聚类主题失败: ${error}`, "error");
      return "未命名主题";
    }
  }
}

/**
 * 后备服务实现（当API不可用时）
 */
class FallbackService implements GenAIService {
  /**
   * 标准化向量维度
   * FallbackService中的标准化实现，与GeminiService保持一致
   * 
   * @param vector 原始向量
   * @param targetDimension 目标维度，默认为3072
   * @returns 标准化后的向量
   */
  normalizeVectorDimension(vector: number[], targetDimension: number = 3072): number[] {
    if (!vector || vector.length === 0) {
      log("[genai_service] 无法标准化空向量", "error");
      return Array.from({ length: targetDimension }, () => 0);
    }
    
    const currentDimension = vector.length;
    
    // 如果已经是目标维度，直接返回
    if (currentDimension === targetDimension) {
      return vector;
    }
    
    log(`[genai_service] 后备标准化向量维度: ${currentDimension} -> ${targetDimension}`, "info");
    
    if (currentDimension < targetDimension) {
      // 通过重复向量内容扩展维度
      const repeats = Math.ceil(targetDimension / currentDimension);
      let extendedVector: number[] = [];
      
      for (let i = 0; i < repeats; i++) {
        extendedVector = extendedVector.concat(vector);
      }
      
      // 截断到目标维度
      return extendedVector.slice(0, targetDimension);
    } else {
      // 如果向量维度大于目标维度，截断为目标维度
      return vector.slice(0, targetDimension);
    }
  }

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
  
  /**
   * 为聚类生成主题名称
   * @param memoryIds 记忆ID数组
   * @returns 聚类主题名称
   */
  async generateClusterTopic(memoryIds: string[]): Promise<string | null> {
    try {
      // 由于我们仅有ID，需要先获取记忆内容
      log(`[genai_service] 为聚类生成主题，ID数量: ${memoryIds.length}`);
      
      // 使用简单主题生成，后续可增强复杂度
      return `主题 ${Math.floor(Math.random() * 1000)}`;
    } catch (error) {
      log(`[genai_service] 生成聚类主题失败: ${error}`, "error");
      return "未命名主题";
    }
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

// 异步初始化
(async () => {
  serviceInitPromise = new Promise(async (resolve) => {
    try {
      genAiService = await createGenAIService();
      resolve();
    } catch (error) {
      log(`[genai_service] 初始化失败: ${error}`, "error");
      // 不再使用后备服务，直接抛出错误
      throw new Error(`Gemini服务初始化失败，请确保API密钥正确: ${error}`);
    }
  });
})();

// 为防止初始导出的genAiService为undefined，提供一个错误提示方法
setTimeout(() => {
  if (!genAiService) {
    log(`[genai_service] 警告：服务初始化可能失败，API调用可能会出错`, "error");
  }
}, 5000);