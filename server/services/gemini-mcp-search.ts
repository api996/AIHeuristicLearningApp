/**
 * Gemini MCP搜索服务
 * 使用Gemini模型的结构化内容处理功能(Message Content Protocol)
 * 优化搜索结果处理，减少嵌入生成API调用
 */

import { log } from "../vite";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generativeai";
import { WebSearchService } from "./web-search";

// 访问已有的WebSearchService实例
import { webSearchService } from "./web-search";

/**
 * 搜索结果接口
 */
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

/**
 * 结构化搜索结果接口
 */
interface StructuredSearchResult {
  summary: string;
  relevance: number;
  keyPoints: string[];
  sources: Array<{
    title: string;
    url: string;
    relevanceScore: number;
  }>;
}

/**
 * Gemini模型的多模态内容块类型
 */
interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/**
 * MCP缓存结构
 */
interface MCPCacheEntry {
  query: string;
  timestamp: number;
  result: StructuredSearchResult;
}

/**
 * Gemini MCP搜索服务类
 * 使用Gemini模型的多模态能力处理结构化内容
 */
export class GeminiMCPSearchService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private model: string;
  private cacheEnabled: boolean = true;
  private contentPrefilteringEnabled: boolean = true;
  
  // 缓存搜索结果
  private searchCache: Map<string, MCPCacheEntry> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1小时过期
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存条目数
  
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    
    // 使用Gemini-2.5-Pro作为主模型，支持多模态和结构化内容
    this.model = 'gemini-2.5-pro-exp-03-25';
    
    // 检查内容预筛选是否启用
    this.contentPrefilteringEnabled = process.env.ENABLE_CONTENT_PRESCREENING === '1';
    
    this.initialize();
    log(`[GeminiMCPSearch] 初始化, 模型=${this.model}, 缓存=${this.cacheEnabled}, 内容预筛选=${this.contentPrefilteringEnabled}`);
  }
  
  /**
   * 初始化Gemini API
   */
  private initialize(): void {
    try {
      if (!this.apiKey) {
        log('[GeminiMCPSearch] 警告: 未设置GEMINI_API_KEY', 'warn');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      log('[GeminiMCPSearch] Gemini API初始化成功');
    } catch (error) {
      log(`[GeminiMCPSearch] 初始化错误: ${error}`, 'error');
      this.genAI = null;
    }
  }
  
  /**
   * 使用Gemini MCP处理搜索结果
   * @param query 搜索查询
   * @param useCache 是否使用缓存
   * @returns 结构化处理后的搜索结果
   */
  public async searchWithMCP(
    query: string,
    useCache: boolean = true
  ): Promise<StructuredSearchResult | null> {
    try {
      // 检查API是否初始化
      if (!this.genAI) {
        log('[GeminiMCPSearch] API未初始化', 'error');
        return null;
      }
      
      // 标准化查询文本
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        log('[GeminiMCPSearch] 空查询', 'warn');
        return null;
      }
      
      // 检查缓存
      if (useCache && this.cacheEnabled) {
        const cachedResult = this.getCachedResult(normalizedQuery);
        if (cachedResult) {
          log('[GeminiMCPSearch] 使用缓存结果');
          return cachedResult;
        }
      }
      
      // 执行网络搜索
      const searchResults = await webSearchService.search(normalizedQuery);
      if (!searchResults || searchResults.length === 0) {
        log('[GeminiMCPSearch] 无搜索结果', 'warn');
        return null;
      }
      
      // 使用MCP处理搜索结果
      const processedResult = await this.processMCPSearch(normalizedQuery, searchResults);
      
      // 添加到缓存
      if (processedResult && this.cacheEnabled) {
        this.cacheResult(normalizedQuery, processedResult);
      }
      
      return processedResult;
    } catch (error) {
      log(`[GeminiMCPSearch] 搜索错误: ${error}`, 'error');
      return null;
    }
  }
  
  /**
   * 使用Gemini模型的MCP功能处理搜索结果
   * @param query 搜索查询
   * @param searchResults 搜索结果
   * @returns 结构化处理后的结果
   */
  private async processMCPSearch(
    query: string,
    searchResults: SearchResult[]
  ): Promise<StructuredSearchResult | null> {
    try {
      // 构建模型实例，设置安全设置
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
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
          }
        ]
      });
      
      // 构建结构化的内容块
      const parts: ContentPart[] = [];
      
      // 添加系统提示
      parts.push({
        text: `我需要您分析以下搜索结果，并给出对于查询"${query}"的全面而简明的回应。请提供：
1. 一个简短摘要（不超过150字）
2. 相关性评分（1-10）
3. 3-5个关键要点
4. 最相关来源列表（包含网址和相关性）

请以JSON格式回复，字段包括：summary, relevance, keyPoints (数组), sources (包含title, url, relevanceScore的对象数组)。
`
      });
      
      // 添加搜索结果部分
      let resultsText = '以下是搜索结果：\n\n';
      
      searchResults.forEach((result, index) => {
        resultsText += `结果 ${index + 1}:\n标题: ${result.title}\n网址: ${result.link}\n摘要: ${result.snippet}\n\n`;
      });
      
      parts.push({ text: resultsText });
      
      // 发送请求到模型
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json'
        }
      });
      
      const response = result.response;
      const textResponse = response.text();
      
      try {
        // 解析JSON响应
        const jsonResult = this.parseJSONResponse(textResponse);
        if (!jsonResult) {
          throw new Error('无法解析JSON响应');
        }
        
        // 构建结构化结果
        const structuredResult: StructuredSearchResult = {
          summary: jsonResult.summary || '未提供摘要',
          relevance: typeof jsonResult.relevance === 'number' ? jsonResult.relevance : 0,
          keyPoints: Array.isArray(jsonResult.keyPoints) ? jsonResult.keyPoints : [],
          sources: Array.isArray(jsonResult.sources) ? jsonResult.sources.map(source => ({
            title: source.title || '未知来源',
            url: source.url || '#',
            relevanceScore: typeof source.relevanceScore === 'number' ? source.relevanceScore : 0
          })) : []
        };
        
        // 如果预筛选启用，检查内容相关性是否足够高
        if (this.contentPrefilteringEnabled && structuredResult.relevance < 3) {
          log(`[GeminiMCPSearch] 内容相关性低 (${structuredResult.relevance}/10)，可能不值得存储`, 'warn');
        }
        
        return structuredResult;
      } catch (jsonError) {
        log(`[GeminiMCPSearch] JSON解析错误: ${jsonError}`, 'error');
        
        // 失败时尝试返回简单文本摘要
        return {
          summary: textResponse.substring(0, 150) + '...',
          relevance: 5,
          keyPoints: [textResponse.substring(0, 100) + '...'],
          sources: searchResults.slice(0, 3).map(result => ({
            title: result.title,
            url: result.link,
            relevanceScore: 5
          }))
        };
      }
    } catch (error) {
      log(`[GeminiMCPSearch] 处理MCP搜索错误: ${error}`, 'error');
      return null;
    }
  }
  
  /**
   * 尝试解析JSON响应
   * 处理各种JSON格式和可能的错误
   * @param text 响应文本
   * @returns 解析后的JSON对象
   */
  private parseJSONResponse(text: string): any {
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
      
      log(`[GeminiMCPSearch] 无法解析JSON: ${text.substring(0, 100)}...`, 'error');
      return null;
    }
  }
  
  /**
   * 从缓存获取结果
   * @param query 查询文本
   * @returns 缓存的结果或null
   */
  private getCachedResult(query: string): StructuredSearchResult | null {
    const cacheKey = this.generateCacheKey(query);
    const entry = this.searchCache.get(cacheKey);
    
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
      return entry.result;
    }
    
    // 删除过期缓存
    if (entry) {
      this.searchCache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * 缓存搜索结果
   * @param query 查询文本
   * @param result 搜索结果
   */
  private cacheResult(query: string, result: StructuredSearchResult): void {
    const cacheKey = this.generateCacheKey(query);
    
    // 如果缓存已满，删除最旧的条目
    if (this.searchCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.searchCache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.searchCache.delete(oldestKey);
      }
    }
    
    // 添加到缓存
    this.searchCache.set(cacheKey, {
      query,
      timestamp: Date.now(),
      result
    });
  }
  
  /**
   * 生成缓存键
   * @param query 查询文本
   * @returns 缓存键
   */
  private generateCacheKey(query: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `mcpsearch_${hash.toString(16)}`;
  }
  
  /**
   * 设置缓存状态
   * @param enabled 是否启用缓存
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    log(`[GeminiMCPSearch] 缓存已${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 设置内容预筛选状态
   * @param enabled 是否启用内容预筛选
   */
  public setContentPrefilteringEnabled(enabled: boolean): void {
    this.contentPrefilteringEnabled = enabled;
    log(`[GeminiMCPSearch] 内容预筛选已${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 清空搜索缓存
   */
  public clearCache(): void {
    this.searchCache.clear();
    log('[GeminiMCPSearch] 缓存已清空');
  }
}

// 导出服务实例
export const geminiMCPSearchService = new GeminiMCPSearchService();