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
let grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY || "";
import fetch from "node-fetch";

export interface GenAIService {
  /**
   * 生成文本的向量嵌入
   * @param text 输入文本
   * @returns 向量嵌入数组
   */
  generateEmbedding(text: string): Promise<number[]>;

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

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      log("[genai_service] 使用统一嵌入管理器生成向量嵌入", "info");
      
      // 导入统一嵌入管理器
      const { embeddingManager } = await import("../embedding/embedding_manager");
      
      // 使用统一管理器生成嵌入
      const embedding = await embeddingManager.generateEmbedding(text);
      
      if (!embedding) {
        const errorMsg = "[genai_service] 嵌入管理器返回空结果";
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }
      
      // 验证嵌入维度
      const expectedDimension = 3072;
      if (embedding.length !== expectedDimension) {
        const errorMsg = `[genai_service] 嵌入维度异常: 实际${embedding.length}维, 期望${expectedDimension}维`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }
      
      log(`[genai_service] 成功生成${embedding.length}维向量嵌入（通过统一管理器）`, "info");
      return embedding;
    } catch (error) {
      const errorMsg = `[genai_service] 生成嵌入失败: ${error}`;
      log(errorMsg, "error");
      throw new Error(errorMsg);
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
      
      // 如果有聚类元数据，记录更详细的信息，便于调试
      if (metadata && metadata.cluster_info) {
        const { memory_count, vector_dimension, center, memory_types, keywords } = metadata.cluster_info;
        const centerInfo = center ? `样本维度[${center.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]` : '无';
        log(`[genai_service] 聚类元数据: ${memory_count}条记忆, 维度=${vector_dimension}, 向量中心=${centerInfo}`);
        
        if (keywords && keywords.length > 0) {
          log(`[genai_service] 聚类关键词: ${keywords.join(', ')}`);
        }
        
        if (memory_types) {
          log(`[genai_service] 记忆类型: ${memory_types}`);
        }
      }
      
      // 合并并截断文本，防止过长
      // 使用最多5个文本样本，并限制每个样本长度以避免超过令牌限制
      const sampleTexts = texts.slice(0, 5).map(text => text.substring(0, 2000));
      const combinedText = sampleTexts.join("\n---\n").substring(0, 10000);
      
      // 使用Gemini 1.5 Flash模型生成主题（更快速的模型版本）
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 判断内容是否有足够的有意义文本
      // 不再使用极简输入检测，这不适合向量聚类场景
      const isMeaningfulContent = texts.some(text => text.trim().length > 5);
      
      // 构建系统提示词，重点强调向量聚类的上下文
      const systemPrompt = "你是AI学习系统中的向量聚类主题专家。你的任务是为系统自动生成的向量聚类组分配一个描述性标签。" + 
        "这些聚类代表了语义相似的学习内容。根据提供的文本样本，请识别共同主题，并给出一个简洁、描述性的标签。" +
        "即使样本很少或简短，也请尝试分析其潜在的教育主题，而不是简单地将其标记为测试数据。";
      
      // 构建提示词
      let prompt = `任务：为向量聚类数据生成主题标签

你在处理的是AI学习系统的向量聚类结果。这些聚类是通过分析文本语义相似度自动生成的，每个聚类代表一组相关的学习内容。
你的任务是为这个聚类生成一个能准确概括其中心主题的标签（最多6个词或20个字符）。

标签要求：
1. 准确性：能准确反映文本样本的核心主题
2. 简洁性：短小易记，便于显示和引用
3. 学科导向：适合教育学习场景
4. 描述性：能让用户一眼理解这个聚类包含什么内容

以下是提取自该聚类的文本样本：`;

      // 如果内容不够充分，添加特别提示
      if (!isMeaningfulContent) {
        prompt += `\n\n注意：当前的文本样本内容较少或较简短。这是向量聚类的原始数据，而非简单的测试输入。
请分析这些内容可能属于什么学科领域或知识类别，给出一个有意义的主题标签。
如果确实无法确定具体主题，可使用相关领域的通用标签，如"AI技术探索"或"编程理论基础"等。`;
      }

      // 如果有元数据，添加上下文信息
      if (metadata && metadata.cluster_info) {
        // 添加聚类相关的元数据
        prompt += `\n\n这些文本属于一个学习记忆聚类组，聚类中包含${metadata.cluster_info.memory_count || '多'}条相关记忆。`;
        
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
      // 移除引号和括号
      let cleanTopic = topic.replace(/["'"【】《》]/g, "");
      // 只取第一行
      cleanTopic = cleanTopic.split(/[\n\r\t]/)[0];
      // 移除常见的标签前缀，如"标签："、"**标签："等
      cleanTopic = cleanTopic.replace(/^(\**)?\s*标签[：:]\s*(\**)?/i, "");
      // 移除主题标签前缀
      cleanTopic = cleanTopic.replace(/^(\**)?\s*主题标签[：:]\s*(\**)?/i, "");
      // 移除标题前缀
      cleanTopic = cleanTopic.replace(/^(\**)?\s*标题[：:]\s*(\**)?/i, "");
      // 移除理由和说明部分（如果有）
      cleanTopic = cleanTopic.split(/(\*\*)?理由[：:]/i)[0].trim();
      // 移除结尾的星号
      cleanTopic = cleanTopic.replace(/\**$/g, "").trim();
      
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
 * Grok AI服务实现
 */
class GrokService implements GenAIService {
  constructor() {
    try {
      if (!grokApiKey) {
        log("[genai_service] 警告: GROK_API_KEY和XAI_API_KEY都未设置", "warn");
      } else {
        log("[genai_service] Grok AI API初始化成功", "info");
      }
    } catch (error) {
      log(`[genai_service] Grok AI API初始化失败: ${error}`, "error");
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      log("[genai_service] 使用统一嵌入管理器生成向量嵌入（Grok服务）", "info");
      
      // 导入统一嵌入管理器
      const { embeddingManager } = await import("../embedding/embedding_manager");
      
      // 使用统一管理器生成嵌入
      const embedding = await embeddingManager.generateEmbedding(text);
      
      if (!embedding) {
        const errorMsg = "[genai_service] 嵌入管理器返回空结果（Grok服务）";
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }
      
      // 验证嵌入维度
      const expectedDimension = 3072;
      if (embedding.length !== expectedDimension) {
        const errorMsg = `[genai_service] 嵌入维度异常: 实际${embedding.length}维, 期望${expectedDimension}维`;
        log(errorMsg, "error");
        throw new Error(errorMsg);
      }
      
      log(`[genai_service] 成功生成${embedding.length}维向量嵌入（通过统一管理器）`, "info");
      return embedding;
    } catch (error) {
      const errorMsg = `[genai_service] 生成嵌入失败: ${error}`;
      log(errorMsg, "error");
      throw new Error(errorMsg);
    }
  }

  async generateSummary(text: string): Promise<string | null> {
    if (!grokApiKey) {
      log("[genai_service] 无法生成摘要: Grok API未初始化", "warn");
      return null;
    }

    try {
      // 截断文本，防止过长
      const truncatedText = text.length > 15000 ? text.substring(0, 15000) + "..." : text;
      
      // 构建Grok API请求体
      const requestBody = {
        model: "grok-3-fast-beta",
        messages: [
          {
            role: "system",
            content: "你是一个专业的摘要生成助手，能够提取核心信息并生成简洁的摘要。"
          },
          {
            role: "user",
            content: `请为以下文本生成一个简洁的摘要（不超过50个字）:\n\n${truncatedText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      };

      // 发送请求
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Grok API返回错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const summary = data.choices?.[0]?.message?.content?.trim() || '';
      
      // 确保摘要不超过数据库字段长度限制
      return summary.length > 255 ? summary.substring(0, 252) + "..." : summary;
    } catch (error) {
      log(`[genai_service] Grok生成摘要失败: ${error}`, "error");
      return null;
    }
  }

  async extractKeywords(text: string): Promise<string[] | null> {
    if (!grokApiKey) {
      log("[genai_service] 无法提取关键词: Grok API未初始化", "warn");
      return null;
    }

    try {
      // 截断文本，防止过长
      const truncatedText = text.length > 10000 ? text.substring(0, 10000) + "..." : text;
      
      // 构建Grok API请求体
      const requestBody = {
        model: "grok-3-fast-beta",
        messages: [
          {
            role: "system",
            content: "你是一个专业的关键词提取助手，能够从文本中准确提取最重要的关键词。"
          },
          {
            role: "user",
            content: `请从以下文本中提取5到10个关键词或短语，以逗号分隔。这些关键词应该能够概括文本的主要内容和主题:\n\n${truncatedText}`
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      };

      // 发送请求
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Grok API返回错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const keywordsText = data.choices?.[0]?.message?.content?.trim() || '';
      
      // 解析关键词（假设返回的是逗号分隔的关键词）
      const keywords = keywordsText
        .split(/[,，、]/)  // 支持中英文分隔符
        .map((kw: string) => kw.trim())
        .filter((kw: string) => kw.length > 0 && kw.length < 50); // 过滤空值和过长的关键词
      
      return keywords.length > 0 ? keywords : null;
    } catch (error) {
      log(`[genai_service] Grok提取关键词失败: ${error}`, "error");
      return null;
    }
  }

  async generateTopicForMemories(texts: string[], metadata?: any): Promise<string | null> {
    if (!grokApiKey) {
      log("[genai_service] 无法生成主题: Grok API未初始化", "warn");
      return null;
    }

    try {
      // 记录输入数据以便调试
      log(`[genai_service] 开始生成主题，接收到${texts.length}条文本样本${metadata ? '和元数据' : ''}`);
      
      // 如果有聚类元数据，记录更详细的信息，便于调试
      if (metadata && metadata.cluster_info) {
        const { memory_count, vector_dimension, center, memory_types, keywords } = metadata.cluster_info;
        const centerInfo = center ? `样本维度[${center.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}...]` : '无';
        log(`[genai_service] 聚类元数据: ${memory_count}条记忆, 维度=${vector_dimension}, 向量中心=${centerInfo}`);
        
        if (keywords && keywords.length > 0) {
          log(`[genai_service] 聚类关键词: ${keywords.join(', ')}`);
        }
        
        if (memory_types) {
          log(`[genai_service] 记忆类型: ${memory_types}`);
        }
      }
      
      if (texts.length === 0) {
        log("[genai_service] 警告: 收到空文本数组，无法生成主题", "warn");
        return "一般讨论";
      }
      
      // 合并并截断文本，防止过长
      // 使用最多5个文本样本，并限制每个样本长度以避免超过令牌限制
      const sampleTexts = texts.slice(0, 5).map(text => text.substring(0, 2000));
      const combinedText = sampleTexts.join("\n---\n").substring(0, 10000);
      
      // 判断内容是否有足够的有意义文本
      // 不再使用极简输入检测，这不适合向量聚类场景
      const isMeaningfulContent = texts.some(text => text.trim().length > 5);
      
      // 构建系统提示词，重点强调向量聚类的上下文
      const systemPrompt = "你是AI学习系统中的向量聚类主题专家。你的任务是为系统自动生成的向量聚类组分配一个描述性标签。" + 
        "这些聚类代表了语义相似的学习内容。根据提供的文本样本，请识别共同主题，并给出一个简洁、描述性的标签。" +
        "即使样本很少或简短，也请尝试分析其潜在的教育主题，而不是简单地将其标记为测试数据。";
      
      // 构建用户提示词
      let prompt = `任务：为向量聚类数据生成主题标签

你在处理的是AI学习系统的向量聚类结果。这些聚类是通过分析文本语义相似度自动生成的，每个聚类代表一组相关的学习内容。
你的任务是为这个聚类生成一个能准确概括其中心主题的标签（最多6个词或20个字符）。

标签要求：
1. 准确性：能准确反映文本样本的核心主题
2. 简洁性：短小易记，便于显示和引用
3. 学科导向：适合教育学习场景
4. 描述性：能让用户一眼理解这个聚类包含什么内容

以下是提取自该聚类的文本样本：`;

      // 如果内容不够充分，添加特别提示
      if (!isMeaningfulContent) {
        prompt += `\n\n注意：当前的文本样本内容较少或较简短。这是向量聚类的原始数据，而非简单的测试输入。
请分析这些内容可能属于什么学科领域或知识类别，给出一个有意义的主题标签。
如果确实无法确定具体主题，可使用相关领域的通用标签，如"AI技术探索"或"编程理论基础"等。`;
      }

      // 如果有元数据，添加上下文信息
      if (metadata && metadata.cluster_info) {
        // 添加聚类相关的元数据
        prompt += `\n\n这些文本属于一个学习记忆聚类组，聚类中包含${metadata.cluster_info.memory_count || '多'}条相关记忆。`;
        
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
      
      // 构建Grok API请求体
      const requestBody = {
        model: "grok-3-fast-beta",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 50
      };

      // 发送请求
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Grok API返回错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // 清理结果
      let topic = data.choices?.[0]?.message?.content?.trim() || '';
      log(`[genai_service] 原始AI生成的主题: "${topic}"`);
      
      // 进一步处理，确保主题简洁
      // 移除引号和括号
      let cleanTopic = topic.replace(/["'"【】《》]/g, "");
      // 只取第一行
      cleanTopic = cleanTopic.split(/[\n\r\t]/)[0]; 
      // 移除常见的标签前缀，如"标签："、"**标签："等
      cleanTopic = cleanTopic.replace(/^(\**)?\s*标签[：:]\s*(\**)?/i, "");
      // 移除主题标签前缀
      cleanTopic = cleanTopic.replace(/^(\**)?\s*主题标签[：:]\s*(\**)?/i, "");
      // 移除标题前缀
      cleanTopic = cleanTopic.replace(/^(\**)?\s*标题[：:]\s*(\**)?/i, "");
      // 移除理由和说明部分（如果有）
      cleanTopic = cleanTopic.split(/(\*\*)?理由[：:]/i)[0].trim();
      // 移除结尾的星号
      cleanTopic = cleanTopic.replace(/\**$/g, "").trim();
      
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
      log(`[genai_service] Grok生成主题失败: ${error}`, "error");
      // 错误情况下直接返回一个固定字符串，而不是null
      return "技术讨论";
    }
  }
}

/**
 * 后备服务实现（当API不可用时）
 */
class FallbackService implements GenAIService {
  async generateEmbedding(text: string): Promise<number[]> {
    // 不再使用随机向量后备，而是抛出异常，确保问题可见
    const errorMsg = "[genai_service] 嵌入服务不可用，且不再提供后备实现";
    log(errorMsg, "error");
    throw new Error(errorMsg);
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
 * 优先使用Gemini API，只有在Gemini不可用时才使用Grok
 * 返回Promise以避免TypeScript错误
 */
const createGenAIService = async (): Promise<GenAIService> => {
  // 优先使用Gemini服务 - 确保生成正确的3072维向量嵌入
  if (geminiApiKey && geminiApiKey.trim() !== "") {
    log("[genai_service] 尝试使用Gemini服务", "info");
    const geminiService = new GeminiService();
    
    try {
      // 测试Gemini API是否可用
      const testTexts = ["测试文本，用于验证Gemini API是否可用"];
      const testTopic = await geminiService.generateTopicForMemories(testTexts);
      
      if (testTopic && testTopic !== "用户问") {
        log(`[genai_service] GenAI 服务已初始化，使用Gemini API，主题生成测试成功: "${testTopic}"`, "info");
        return geminiService;
      } else {
        throw new Error(`[genai_service] Gemini API测试返回无效主题或错误结果: "${testTopic}"，请检查API密钥是否有效`);
      }
    } catch (error) {
      log(`[genai_service] Gemini API初始化失败: ${error}`, "error");
      throw error; // 向上抛出错误，不使用后备服务
    }
  }
  
  // 如果Gemini API不可用，抛出明确的错误
  throw new Error("[genai_service] 未设置Gemini API密钥，请配置GEMINI_API_KEY环境变量");
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
    // 不再静默地使用后备服务，而是向上抛出错误，使问题可见
    const errorMsg = `[genai_service] 初始化失败: ${error}, 请检查API密钥和环境设置`;
    log(errorMsg, "error");
    throw new Error(errorMsg);
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
      // 服务初始化失败是严重错误，应打印明确的错误信息
      console.error(`
====================================
严重错误: GenAI服务初始化失败
请确保GEMINI_API_KEY已正确设置
需要Gemini API密钥才能生成正确的3072维向量嵌入
====================================
      `);
    }
  });
})();

// 为防止初始导出的genAiService为undefined，提供一个错误提示方法
setTimeout(() => {
  if (!genAiService) {
    const errorMsg = "[genai_service] 严重错误：GenAI服务初始化失败，向量嵌入功能无法使用，请确保GEMINI_API_KEY正确配置";
    log(errorMsg, "error");
    // 由于我们现在不再使用后备服务，这里抛出一个更为明确的错误
    throw new Error(errorMsg);
  }
}, 5000);