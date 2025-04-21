/**
 * 内容价值分析服务
 * 使用轻量级Gemini-2.0-flash模型快速分析内容价值
 * 用于预筛选内容，减少不必要的嵌入生成API调用
 */

import { log } from "../vite";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generativeai";

/**
 * 内容价值分析结果接口
 */
export interface ContentValueAnalysisResult {
  isValuable: boolean; // 内容是否有价值
  score: number;       // 内容价值评分 (0-1)
  reason: string;      // 评估原因
}

/**
 * 分析缓存条目
 */
interface AnalysisCacheEntry {
  content: string;       // 原始内容
  result: ContentValueAnalysisResult; // 分析结果
  timestamp: number;     // 缓存时间戳
}

/**
 * 内容价值分析服务
 * 使用轻量级模型快速判断内容是否值得生成嵌入向量
 */
export class ContentValueAnalyzer {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private model: string;
  private enabled: boolean = true;
  private threshold: number = 0.4;  // 价值阈值，低于此值的内容不生成嵌入
  private minContentLength: number = 15; // 最小内容长度
  
  // 缓存分析结果
  private analysisCache: Map<string, AnalysisCacheEntry> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 缓存有效期24小时
  private readonly MAX_CACHE_SIZE = 200; // 最大缓存条目数
  
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    
    // 使用轻量级模型以提高速度，降低API成本
    this.model = 'gemini-2.0-flash';
    
    // 环境变量控制是否启用内容价值预筛选
    this.enabled = process.env.ENABLE_CONTENT_PRESCREENING === '1';
    
    // 初始化API客户端
    this.initialize();
    log(`[ContentValueAnalyzer] 初始化, 模型=${this.model}, 启用=${this.enabled}, 阈值=${this.threshold}`);
  }
  
  /**
   * 初始化Gemini API
   */
  private initialize(): void {
    try {
      if (!this.apiKey) {
        log('[ContentValueAnalyzer] 警告: 未设置GEMINI_API_KEY', 'warn');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      log('[ContentValueAnalyzer] Gemini API初始化成功');
    } catch (error) {
      log(`[ContentValueAnalyzer] 初始化错误: ${error}`, 'error');
      this.genAI = null;
    }
  }
  
  /**
   * 分析内容价值
   * 判断内容是否值得生成嵌入向量
   * @param content 内容文本
   * @param bypassCache 是否跳过缓存
   * @returns 内容价值分析结果
   */
  public async analyzeContentValue(
    content: string,
    bypassCache: boolean = false
  ): Promise<ContentValueAnalysisResult> {
    try {
      // 如果服务未启用，默认所有内容都有价值
      if (!this.enabled) {
        return this.getDefaultValueAnalysis(true, '内容价值分析服务已禁用');
      }
      
      // 检查内容长度
      if (!content || content.trim().length < this.minContentLength) {
        return this.getDefaultValueAnalysis(false, `内容太短 (${content?.trim().length || 0} < ${this.minContentLength}字符)`);
      }
      
      // 检查API是否初始化
      if (!this.genAI) {
        return this.getDefaultValueAnalysis(true, 'API未初始化，假定内容有价值');
      }
      
      // 清理和截断内容
      const cleanedContent = this.cleanAndTruncateContent(content);
      
      // 检查缓存
      if (!bypassCache) {
        const cachedResult = this.getCachedAnalysis(cleanedContent);
        if (cachedResult) {
          log('[ContentValueAnalyzer] 使用缓存的内容价值分析');
          return cachedResult;
        }
      }
      
      // 使用轻量级模型分析内容价值
      const analysisResult = await this.callGeminiForAnalysis(cleanedContent);
      
      // 缓存结果
      if (analysisResult) {
        this.cacheAnalysisResult(cleanedContent, analysisResult);
      }
      
      return analysisResult || this.getDefaultValueAnalysis(true, 'API调用失败，假定内容有价值');
    } catch (error) {
      log(`[ContentValueAnalyzer] 分析错误: ${error}`, 'error');
      return this.getDefaultValueAnalysis(true, `分析出错: ${error}`);
    }
  }
  
  /**
   * 调用Gemini模型分析内容价值
   * @param content 内容文本
   * @returns 分析结果
   */
  private async callGeminiForAnalysis(content: string): Promise<ContentValueAnalysisResult | null> {
    try {
      // 构建模型实例
      const model = this.genAI!.getGenerativeModel({
        model: this.model,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          }
        ]
      });
      
      // 构建提示词
      const prompt = `
分析以下内容，判断是否包含实质性的教育价值，是否值得长期记忆或向量化。
评估标准:
1. 信息密度 - 内容包含的信息点数量
2. 知识深度 - 涉及概念的复杂度和深度
3. 教育价值 - 内容对学习的帮助程度
4. 长期参考价值 - 内容是否值得长期保存

忽略以下无实质内容:
- 简单问候
- 简短测试消息
- 无实质内容的闲聊
- 简单的是/否回答
- 纯情绪表达
- 重复内容

内容:
${content}

请以JSON格式回复，包含以下字段:
- isValuable: boolean (内容是否有价值)
- score: number (0-1评分，表示价值程度)
- reason: string (简要解释评分原因，20字以内)`;

      // 发送请求到模型
      const result = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 256,
          responseMimeType: 'application/json'
        }
      });
      
      const response = result.response;
      const textResponse = response.text();
      
      try {
        // 解析JSON响应
        const jsonResult = this.parseJsonResponse(textResponse);
        if (!jsonResult) {
          throw new Error('无法解析JSON响应');
        }
        
        // 构建分析结果
        return {
          isValuable: Boolean(jsonResult.isValuable),
          score: typeof jsonResult.score === 'number' ? 
                 Math.max(0, Math.min(1, jsonResult.score)) : 0.5, // 确保分数在0-1范围内
          reason: jsonResult.reason || '未提供原因'
        };
      } catch (jsonError) {
        log(`[ContentValueAnalyzer] JSON解析错误: ${jsonError}`, 'error');
        
        // 当JSON解析失败时，尝试基于文本响应进行简单判断
        const lowerTextResponse = textResponse.toLowerCase();
        const isValuable = !lowerTextResponse.includes('无价值') && 
                           !lowerTextResponse.includes('不值得') &&
                           !lowerTextResponse.includes('低价值');
        
        return {
          isValuable,
          score: isValuable ? 0.6 : 0.3,
          reason: '响应解析失败，基于文本做出判断'
        };
      }
    } catch (error) {
      log(`[ContentValueAnalyzer] 调用Gemini API失败: ${error}`, 'error');
      return null;
    }
  }
  
  /**
   * 尝试解析JSON响应
   * 处理各种JSON格式和可能的错误
   * @param text 响应文本
   * @returns 解析后的JSON对象
   */
  private parseJsonResponse(text: string): any {
    try {
      // 尝试直接解析
      return JSON.parse(text);
    } catch (error) {
      // 尝试提取JSON部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          // 继续尝试其他方法
        }
      }
      
      // 寻找Markdown JSON代码块
      const codeBlockMatch = text.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch (codeBlockError) {
          // 继续尝试其他方法
        }
      }
      
      throw new Error('无法解析JSON响应');
    }
  }
  
  /**
   * 清理和截断内容
   * @param content 原始内容
   * @returns 处理后的内容
   */
  private cleanAndTruncateContent(content: string): string {
    // 移除多余空白
    let cleaned = content.replace(/\s+/g, ' ').trim();
    
    // 截断过长内容
    if (cleaned.length > 1000) {
      cleaned = cleaned.substring(0, 1000);
    }
    
    return cleaned;
  }
  
  /**
   * 获取默认分析结果
   * @param isValuable 是否有价值
   * @param reason 原因
   * @returns 默认分析结果
   */
  private getDefaultValueAnalysis(isValuable: boolean, reason: string): ContentValueAnalysisResult {
    return {
      isValuable,
      score: isValuable ? 0.7 : 0.2,
      reason
    };
  }
  
  /**
   * 生成缓存键
   * @param content 内容文本
   * @returns 缓存键
   */
  private generateCacheKey(content: string): string {
    // 简单的哈希函数
    let hash = 0;
    const str = content.substring(0, 200); // 只使用前200个字符生成哈希
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `value_${hash.toString(16)}`;
  }
  
  /**
   * 从缓存获取分析结果
   * @param content 内容文本
   * @returns 缓存的分析结果或null
   */
  private getCachedAnalysis(content: string): ContentValueAnalysisResult | null {
    const cacheKey = this.generateCacheKey(content);
    const entry = this.analysisCache.get(cacheKey);
    
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
      return entry.result;
    }
    
    // 删除过期缓存
    if (entry) {
      this.analysisCache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * 缓存分析结果
   * @param content 内容文本
   * @param result 分析结果
   */
  private cacheAnalysisResult(content: string, result: ContentValueAnalysisResult): void {
    const cacheKey = this.generateCacheKey(content);
    
    // 如果缓存已满，删除最旧的条目
    if (this.analysisCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.analysisCache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.analysisCache.delete(oldestKey);
      }
    }
    
    // 添加到缓存
    this.analysisCache.set(cacheKey, {
      content,
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * 启用或禁用内容价值分析
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    log(`[ContentValueAnalyzer] 服务已${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 设置价值阈值
   * @param threshold 阈值值 (0-1)
   */
  public setThreshold(threshold: number): void {
    // 确保阈值在有效范围内
    this.threshold = Math.max(0, Math.min(1, threshold));
    log(`[ContentValueAnalyzer] 价值阈值已设置为 ${this.threshold}`);
  }
  
  /**
   * 检查内容是否值得生成嵌入向量
   * @param content 内容文本
   * @param bypassCheck 是否跳过检查
   * @returns 是否应生成嵌入
   */
  public async shouldGenerateEmbedding(
    content: string,
    bypassCheck: boolean = false
  ): Promise<boolean> {
    // 如果要求跳过检查，直接返回true
    if (bypassCheck) {
      return true;
    }
    
    // 如果服务禁用，所有内容都生成嵌入
    if (!this.enabled) {
      return true;
    }
    
    // 进行内容价值分析
    const analysis = await this.analyzeContentValue(content);
    
    // 如果分数低于阈值，不生成嵌入
    if (!analysis.isValuable || analysis.score < this.threshold) {
      log(`[ContentValueAnalyzer] 内容不满足嵌入条件: ${analysis.reason}, 分数=${analysis.score}/${this.threshold}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * 清空分析缓存
   */
  public clearCache(): void {
    this.analysisCache.clear();
    log('[ContentValueAnalyzer] 缓存已清空');
  }
}

// 导出服务实例
export const contentValueAnalyzer = new ContentValueAnalyzer();