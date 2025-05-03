/**
 * 轻量级对话阶段分析服务
 * 使用Gemini-2.0-flash模型进行更快速的对话分析
 */

import { log } from "../vite";
import { storage } from "../storage";
import { type Message } from "../../shared/schema";
import fetch from "node-fetch";

/**
 * 日志级别枚举
 */
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 增强型日志函数
 * @param message 日志消息
 * @param level 日志级别
 * @param context 上下文信息
 */
function enhancedLog(message: string, level: LogLevel = LogLevel.INFO, context: Record<string, any> = {}): void {
  // 添加时间戳
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [ConversationAnalytics] `;
  
  // 基本日志
  log(`${prefix}${message}`);
  
  // 对于错误级别，记录更多上下文信息
  if (level === LogLevel.ERROR || level === LogLevel.WARN) {
    if (Object.keys(context).length > 0) {
      let contextStr = '';
      try {
        // 处理可能的循环引用
        contextStr = JSON.stringify(context, (key, value) => {
          if (key === 'stack' || key === 'body') {
            return String(value).substring(0, 500) + (String(value).length > 500 ? '...' : '');
          }
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[循环引用]';
            }
            seen.add(value);
          }
          return value;
        }, 2);
      } catch (e) {
        contextStr = `[无法序列化上下文: ${e}]`;
      }
      log(`${prefix}上下文: ${contextStr}`);
    }
  }
  
  // 用于跟踪JSON序列化中的循环引用
  const seen = new Set();
}

/**
 * 请求和响应追踪工具
 */
class ApiTracer {
  static requestCount: number = 0;
  static successCount: number = 0;
  static errorCount: number = 0;
  static timeoutCount: number = 0;
  
  /**
   * 记录API请求开始
   * @returns 请求ID
   */
  static startRequest(): number {
    this.requestCount++;
    return this.requestCount;
  }
  
  /**
   * 记录API请求成功
   */
  static logSuccess(): void {
    this.successCount++;
    this.logStats();
  }
  
  /**
   * 记录API请求失败
   * @param isTimeout 是否是超时错误
   */
  static logError(isTimeout: boolean = false): void {
    if (isTimeout) {
      this.timeoutCount++;
    }
    this.errorCount++;
    this.logStats();
  }
  
  /**
   * 输出统计信息
   */
  private static logStats(): void {
    // 每10次请求输出一次统计信息
    if (this.requestCount % 10 === 0) {
      const successRate = ((this.successCount / this.requestCount) * 100).toFixed(1);
      enhancedLog(
        `API统计: 总请求=${this.requestCount}, 成功=${this.successCount}, ` + 
        `失败=${this.errorCount}, 超时=${this.timeoutCount}, 成功率=${successRate}%`,
        LogLevel.INFO
      );
    }
  }
}

export type ConversationPhase = "K" | "W" | "L" | "Q";

export interface PhaseAnalysisResult {
  currentPhase: ConversationPhase;
  summary: string;
  confidence: number;
}

/**
 * 轻量级对话阶段分析服务
 * 使用Gemini-2.0-flash模型对对话内容进行快速摘要和阶段识别
 * 
 * 对话阶段:
 * K - 知识获取阶段 (Knowledge Acquisition): 用户主要是获取信息和知识
 * W - 疑惑表达阶段 (Wondering): 用户表达疑惑、困惑或不确定性
 * L - 学习深化阶段 (Learning Deepening): 用户在理解和应用知识，寻求更深层次的解释
 * Q - 质疑挑战阶段 (Questioning): 用户在批判性思考，验证信息或提供反馈
 */
export class ConversationAnalyticsLightService {
  private apiKey: string;
  private endpoint: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    // 使用更快速的gemini-2.0-flash模型，适合后台分析，更高的频率限制
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    // 默认优先使用Grok API，它没有频率限制
    log("轻量级对话阶段分析服务初始化完成，优先使用Grok API");
  }

  /**
   * 分析对话阶段
   * @param chatId 聊天ID
   * @param messages 最近的消息列表
   * @returns 对话阶段分析结果
   */
  async analyzeConversationPhase(chatId: number, messages: Message[]): Promise<PhaseAnalysisResult | null> {
    try {
      // 只分析最近的5-8条消息，以获得当前阶段
      const recentMessages = messages.slice(-8);
      const conversationText = this.formatConversation(recentMessages);
      
      // 调用Gemini进行分析，使用超时限制
      const analysisResult = await this.callGeminiForAnalysis(conversationText);
      
      // 如果分析成功，保存结果到数据库
      if (analysisResult) {
        await storage.saveConversationAnalytic(
          chatId,
          analysisResult.currentPhase,
          analysisResult.summary
        );
        
        log(`轻量级对话分析结果: 阶段=${analysisResult.currentPhase}, 摘要="${analysisResult.summary.substring(0, 50)}..."`);
        return analysisResult;
      }
      
      return null;
    } catch (error) {
      log(`轻量级对话阶段分析错误: ${error}`);
      return this.backoffToKeywordAnalysis(messages);  // 失败时回退到关键词分析
    }
  }

  /**
   * 获取特定聊天的最新对话阶段
   * @param chatId 聊天ID
   * @returns 对话阶段
   */
  async getLatestPhase(chatId: number): Promise<ConversationPhase | null> {
    try {
      const analytic = await storage.getLatestConversationAnalytic(chatId);
      return analytic?.currentPhase || null;
    } catch (error) {
      log(`获取最新对话阶段错误: ${error}`);
      return null;
    }
  }

  /**
   * 格式化对话内容
   * @param messages 消息列表
   * @returns 格式化后的对话文本
   */
  private formatConversation(messages: Message[]): string {
    return messages.map((msg, index) => {
      const role = msg.role === "user" ? "用户" : "AI助手";
      return `[${index + 1}] ${role}: ${msg.content}`;
    }).join("\n\n");
  }

  /**
   * 调用Gemini-2.0-flash进行对话分析
   * 使用更轻量级的模型以提高速度，减少超时
   * @param conversationText 对话文本
   * @returns 对话阶段分析结果
   */
  // 缓存配置
  private cache: Map<string, {
    result: PhaseAnalysisResult;
    timestamp: number;
  }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 缓存有效期10分钟
  private readonly CACHE_MAX_SIZE = 100; // 最大缓存条目数

  /**
   * 为对话生成一个唯一缓存键
   * @param text 对话文本
   * @returns 缓存键
   */
  private generateCacheKey(text: string): string {
    // 简单的散列函数，将文本转换为数字
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return `conversation_${hash}`;
  }

  /**
   * 从缓存中获取分析结果
   * @param text 对话文本
   * @returns 缓存的分析结果或null
   */
  private getCachedResult(text: string): PhaseAnalysisResult | null {
    const key = this.generateCacheKey(text);
    const cached = this.cache.get(key);
    
    if (cached) {
      const now = Date.now();
      // 检查缓存是否过期
      if (now - cached.timestamp <= this.CACHE_TTL) {
        enhancedLog(`从缓存获取对话分析结果: ${cached.result.currentPhase}`, LogLevel.DEBUG);
        return cached.result;
      } else {
        // 删除过期缓存
        this.cache.delete(key);
        enhancedLog(`缓存过期，已清除: ${key}`, LogLevel.DEBUG);
      }
    }
    return null;
  }

  /**
   * 将分析结果保存到缓存
   * @param text 对话文本
   * @param result 分析结果
   */
  private cacheResult(text: string, result: PhaseAnalysisResult): void {
    const key = this.generateCacheKey(text);
    
    // 如果缓存已满，清除最早添加的条目
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        enhancedLog(`缓存已满，清除最早条目: ${oldestKey}`, LogLevel.DEBUG);
      }
    }
    
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
    enhancedLog(`已缓存对话分析结果: ${key}`, LogLevel.DEBUG);
  }

  /**
   * 调用AI模型进行对话分析
   * 优先使用Grok API，如果不可用则回退到Gemini
   * @param conversationText 对话文本
   * @returns 对话阶段分析结果
   */
  private async callGeminiForAnalysis(conversationText: string): Promise<PhaseAnalysisResult | null> {
    // 先检查缓存中是否有结果
    const cachedResult = this.getCachedResult(conversationText);
    if (cachedResult) {
      enhancedLog("使用缓存的对话阶段分析结果", LogLevel.DEBUG);
      return cachedResult;
    }
    
    // 优先尝试使用Grok API (没有请求限制)
    const grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    if (grokApiKey) {
      try {
        enhancedLog("尝试使用Grok API进行对话分析", LogLevel.INFO);
        return await this.callGrokForAnalysis(conversationText, grokApiKey);
      } catch (error) {
        enhancedLog(`Grok API调用失败，回退到Gemini: ${error}`, LogLevel.WARN);
        // 如果Grok失败，继续尝试Gemini
      }
    }
    
    // 如果没有Gemini API密钥，使用关键词分析（零API调用）
    if (!this.apiKey) {
      enhancedLog("没有可用的AI API密钥，使用关键词分析替代", LogLevel.WARN);
      return this.backoffToKeywordAnalysis(conversationText);
    }

    // 追踪API请求
    const requestId = ApiTracer.startRequest();
    enhancedLog(`开始对话阶段分析请求 #${requestId}`, LogLevel.DEBUG);

    try {
      const prompt = `
分析以下对话，确定当前对话所处的阶段并提供简短摘要。简洁回答，不要解释。

对话阶段分类:
- K (知识获取): 用户主要在寻求基本信息和知识
- W (疑惑表达): 用户表达困惑或对概念的难以理解
- L (学习深化): 用户正在更深入地学习或应用知识
- Q (质疑挑战): 用户在批判性思考或质疑信息

对话:
${conversationText}

以JSON格式回答，包含以下字段:
- currentPhase: 对话当前阶段 (K, W, L, 或 Q)
- summary: 简短摘要 (20字以内)
- confidence: 置信度 (0.0到1.0之间的数字)`;

      // 创建请求配置，添加超时控制
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 256,  // 限制输出长度以加快处理速度
          responseMimeType: "application/json"
        }
      };

      // 发送请求，设置较短的超时时间
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      try {
        const startTime = Date.now();
        const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        clearTimeout(timeout); // 清除超时
        
        if (!response.ok) {
          const errorText = await response.text();
          enhancedLog(
            `Gemini API错误 #${requestId}: ${response.status} - ${errorText}`, 
            LogLevel.ERROR, 
            { statusCode: response.status, responseTime }
          );
          ApiTracer.logError(false);
          return this.backoffToKeywordAnalysis(conversationText);
        }

        // 使用类型断言确保正确处理响应数据
        const data = await response.json();
        
        // 定义Gemini响应的接口
        interface GeminiResponse {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
              }>;
            };
          }>;
        }
        
        // 提取响应中的JSON文本
        const typedData = data as GeminiResponse;
        const jsonText = typedData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        if (!jsonText) {
          enhancedLog(
            `Gemini API返回空响应 #${requestId}`,
            LogLevel.ERROR,
            { responseTime }
          );
          ApiTracer.logError(false);
          return this.backoffToKeywordAnalysis(conversationText);
        }
        
        try {
          // 解析响应中的JSON
          const parseResult = JSON.parse(jsonText);
          
          // 验证必要字段
          if (!parseResult.currentPhase || !["K", "W", "L", "Q"].includes(parseResult.currentPhase)) {
            enhancedLog(
              `无效的对话阶段值 #${requestId}: ${parseResult.currentPhase}`,
              LogLevel.ERROR,
              { parseResult, responseTime }
            );
            ApiTracer.logError(false);
            return this.backoffToKeywordAnalysis(conversationText);
          }
          
          // 标记API请求成功
          ApiTracer.logSuccess();
          
          // 构建结果
          const result: PhaseAnalysisResult = {
            currentPhase: parseResult.currentPhase as ConversationPhase,
            summary: parseResult.summary || "对话分析",
            confidence: parseResult.confidence || 0.7
          };
          
          // 缓存结果
          this.cacheResult(conversationText, result);
          
          enhancedLog(
            `对话阶段分析成功 #${requestId}: ${result.currentPhase} (${responseTime}ms)`,
            LogLevel.INFO,
            { responseTime, confidence: result.confidence }
          );
          
          return result;
        } catch (parseError) {
          enhancedLog(
            `解析Gemini响应JSON失败 #${requestId}: ${parseError}`,
            LogLevel.ERROR,
            { 
              error: parseError,
              responseText: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
              responseTime 
            }
          );
          ApiTracer.logError(false);
          return this.backoffToKeywordAnalysis(conversationText);
        }
      } catch (error) {
        clearTimeout(timeout); // 确保清除超时
        const fetchError = error as Error;
        const isTimeout = fetchError.name === 'AbortError';
        
        enhancedLog(
          isTimeout 
            ? `Gemini API请求超时 #${requestId}` 
            : `Gemini API请求失败 #${requestId}: ${fetchError.message}`,
          LogLevel.ERROR,
          { error: fetchError.message, stack: fetchError.stack, isTimeout }
        );
        
        ApiTracer.logError(isTimeout);
        return this.backoffToKeywordAnalysis(conversationText);
      }
    } catch (error) {
      enhancedLog(
        `对话阶段分析失败 #${requestId}: ${error}`,
        LogLevel.ERROR,
        { error }
      );
      ApiTracer.logError(false);
      return this.backoffToKeywordAnalysis(conversationText);
    }
  }
  
  /**
   * 回退到基于关键词的分析方法
   * 当API调用失败或超时时使用，不需要额外的API调用
   * @param input 输入文本或消息列表
   * @returns 对话阶段分析结果
   */
  private backoffToKeywordAnalysis(input: string | Message[]): PhaseAnalysisResult {
    let text: string;
    
    // 转换输入为文本
    if (typeof input === 'string') {
      text = input;
    } else {
      // 只分析用户消息
      text = input.filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(" ");
    }
    
    // 转为小写以进行不区分大小写的匹配
    const lowerText = text.toLowerCase();
    
    // 每个阶段的关键词
    const keywordMap: Record<ConversationPhase, string[]> = {
      "K": ["什么是", "告诉我", "解释", "定义", "概念", "学习", "了解", "知道"],
      "W": ["为什么", "如何", "不明白", "困惑", "疑惑", "不懂", "不确定", "什么意思"],
      "L": ["能不能", "更深入", "例子", "应用", "怎么实现", "使用", "实践", "案例"],
      "Q": ["但是", "然而", "质疑", "挑战", "不同意", "证据", "真的吗", "批判"]
    };
    
    // 计算每个阶段的关键词匹配度
    const scores: Record<ConversationPhase, number> = { "K": 0, "W": 0, "L": 0, "Q": 0 };
    
    for (const [phase, keywords] of Object.entries(keywordMap) as [ConversationPhase, string[]][]) {
      for (const keyword of keywords) {
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerText.match(regex);
        if (matches) {
          scores[phase] += matches.length;
        }
      }
    }
    
    // 查找得分最高的阶段
    let highestPhase: ConversationPhase = "K"; // 默认为知识获取
    let highestScore = scores["K"];
    
    for (const phase of ["W", "L", "Q"] as ConversationPhase[]) {
      if (scores[phase] > highestScore) {
        highestPhase = phase;
        highestScore = scores[phase];
      }
    }
    
    // 根据阶段生成摘要
    const summaries: Record<ConversationPhase, string> = {
      "K": "用户正在寻求基本知识或信息",
      "W": "用户表达困惑或对概念的不确定性",
      "L": "用户正在应用或深化理解",
      "Q": "用户表现出批判性思考或质疑"
    };
    
    return {
      currentPhase: highestPhase,
      summary: summaries[highestPhase],
      confidence: 0.6 // 关键词匹配的置信度较低
    };
  }
  
  /**
   * 使用Grok API进行对话分析
   * @param conversationText 对话文本
   * @param apiKey Grok API密钥
   * @returns 对话阶段分析结果
   */
  private async callGrokForAnalysis(conversationText: string, apiKey: string): Promise<PhaseAnalysisResult | null> {
    // 追踪API请求
    const requestId = ApiTracer.startRequest();
    enhancedLog(`开始Grok对话阶段分析请求 #${requestId}`, LogLevel.DEBUG);
    
    try {
      // 构建Grok API所需的提示词
      const prompt = `
分析以下对话，确定当前对话所处的阶段并提供简短摘要。简洁回答，不要解释。

对话阶段分类:
- K (知识获取): 用户主要在寻求基本信息和知识
- W (疑惑表达): 用户表达困惑或对概念的难以理解
- L (学习深化): 用户正在更深入地学习或应用知识
- Q (质疑挑战): 用户在批判性思考或质疑信息

对话:
${conversationText}

以JSON格式回答，包含以下字段:
- currentPhase: 对话当前阶段 (K, W, L, 或 Q)
- summary: 简短摘要 (20字以内)
- confidence: 置信度 (0.0到1.0之间的数字)`;

      // 创建Grok API请求体
      const requestBody = {
        model: "grok-3-fast-beta", // 使用fast变体以获得更低的延迟
        messages: [
          {
            role: "system",
            content: "你是一个专业的对话分析助手，善于精确分析对话阶段并提供简短准确的摘要。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 256,
        response_format: { type: "json_object" } // 请求JSON格式响应
      };

      // 发送请求，设置较短的超时时间
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      try {
        const startTime = Date.now();
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        clearTimeout(timeout); // 清除超时
        
        if (!response.ok) {
          const errorText = await response.text();
          enhancedLog(
            `Grok API错误 #${requestId}: ${response.status} - ${errorText}`, 
            LogLevel.ERROR, 
            { statusCode: response.status, responseTime }
          );
          ApiTracer.logError(false);
          throw new Error(`Grok API错误: ${response.status}`);
        }

        // 解析响应
        const data = await response.json();
        const jsonText = data.choices?.[0]?.message?.content || "";
        
        if (!jsonText) {
          enhancedLog(
            `Grok API返回空响应 #${requestId}`,
            LogLevel.ERROR,
            { responseTime }
          );
          ApiTracer.logError(false);
          throw new Error("Grok API返回空响应");
        }
        
        try {
          // 解析响应中的JSON
          const parseResult = JSON.parse(jsonText);
          
          // 验证必要字段
          if (!parseResult.currentPhase || !["K", "W", "L", "Q"].includes(parseResult.currentPhase)) {
            enhancedLog(
              `无效的对话阶段值 #${requestId}: ${parseResult.currentPhase}`,
              LogLevel.ERROR,
              { parseResult, responseTime }
            );
            ApiTracer.logError(false);
            throw new Error(`无效的对话阶段值: ${parseResult.currentPhase}`);
          }
          
          // 标记API请求成功
          ApiTracer.logSuccess();
          
          // 构建结果
          const result: PhaseAnalysisResult = {
            currentPhase: parseResult.currentPhase as ConversationPhase,
            summary: parseResult.summary || "对话分析",
            confidence: parseResult.confidence || 0.7
          };
          
          // 缓存结果
          this.cacheResult(conversationText, result);
          
          enhancedLog(
            `Grok对话阶段分析成功 #${requestId}: ${result.currentPhase} (${responseTime}ms)`,
            LogLevel.INFO,
            { responseTime, confidence: result.confidence }
          );
          
          return result;
        } catch (parseError) {
          enhancedLog(
            `解析Grok响应JSON失败 #${requestId}: ${parseError}`,
            LogLevel.ERROR,
            { 
              error: parseError,
              responseText: jsonText.substring(0, 200) + (jsonText.length > 200 ? '...' : ''),
              responseTime 
            }
          );
          ApiTracer.logError(false);
          throw new Error(`解析Grok响应JSON失败: ${parseError}`);
        }
      } catch (error) {
        clearTimeout(timeout); // 确保清除超时
        const fetchError = error as Error;
        const isTimeout = fetchError.name === 'AbortError';
        
        enhancedLog(
          isTimeout 
            ? `Grok API请求超时 #${requestId}` 
            : `Grok API请求失败 #${requestId}: ${fetchError.message}`,
          LogLevel.ERROR,
          { error: fetchError.message, stack: fetchError.stack, isTimeout }
        );
        
        ApiTracer.logError(isTimeout);
        throw fetchError;
      }
    } catch (error) {
      enhancedLog(
        `Grok对话阶段分析失败 #${requestId}: ${error}`,
        LogLevel.ERROR,
        { error }
      );
      ApiTracer.logError(false);
      throw error;
    }
  }
}

// 创建服务实例
export const conversationAnalyticsLightService = new ConversationAnalyticsLightService();