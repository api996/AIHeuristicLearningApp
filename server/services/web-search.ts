/**
 * 增强版网络搜索服务
 * 基于自定义结构化搜索结果处理（Custom MCP）实现的搜索功能
 * 集成Gemini优化内容处理
 * 
 * 注意: 此实现使用的是自定义的结构化搜索处理方法，而非 Anthropic 标准的 Model Context Protocol (MCP)
 * 为避免混淆，我们将此实现称为 "CustomMCP"，标准的 Anthropic MCP 实现位于 server/services/mcp/ 目录
 */

import fetch from "node-fetch";
import { storage } from "../storage";
import { log } from "../vite";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

/**
 * 搜索结果摘要接口
 */
export interface SearchSnippet {
  title: string;
  snippet: string;
  url: string;
}

/**
 * 自定义结构化搜索结果接口 (CustomMCP)
 * 结构化的搜索结果，优化模型理解
 */
export interface CustomMCPSearchResult {
  query: string;           // 原始查询
  userIntent?: string;     // 用户真实意图
  summary: string;         // 结果概述
  relevance: number;       // 相关性评分 (1-10)
  keyPoints: string[];     // 关键信息点
  sources: {               // 信息来源
    title: string;
    url: string;
    content: string;
    relevanceToIntent?: number; // 与用户意图的相关性
    sourceQuality?: number;     // 来源质量评分
  }[];
  timestamp: number;       // 搜索时间戳
}

/**
 * 自定义结构化搜索缓存条目 (CustomMCP)
 */
interface CustomMCPCacheEntry {
  query: string;
  result: CustomMCPSearchResult;
  expiresAt: number;
}

/**
 * 内容价值评估结果
 */
interface ContentValueAssessment {
  isValuable: boolean;
  score: number;
  reason: string;
}

/**
 * 搜索服务类
 */
export class WebSearchService {
  private apiKey: string;
  private geminiApiKey: string;
  private searchEndpoint: string;
  private cacheEnabled: boolean;
  private cacheExpiryMinutes: number;
  private mcpEnabled: boolean;
  private genAI: GoogleGenerativeAI | null = null;
  private mcpCache: Map<string, CustomMCPCacheEntry> = new Map();
  private mcpCacheSize: number = 200;
  
  // 内容价值评估阈值
  private contentValueThreshold: number = 0.4;

  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || "";
    this.geminiApiKey = process.env.GEMINI_API_KEY || "";
    this.searchEndpoint = "https://google.serper.dev/search";
    this.cacheEnabled = true; // 默认启用缓存
    this.cacheExpiryMinutes = 60; // 默认缓存1小时
    
    // 默认启用MCP，优化搜索处理
    this.mcpEnabled = true;
    
    // 初始化Gemini API客户端
    this.initializeGeminiAPI();
    
    log(`WebSearchService 初始化，缓存${this.cacheEnabled ? '开启' : '关闭'}, MCP${this.mcpEnabled ? '开启' : '关闭'}`);
  }
  
  /**
   * 初始化Gemini API客户端
   */
  private initializeGeminiAPI(): void {
    try {
      if (!this.geminiApiKey) {
        log(`WebSearchService: Gemini API密钥未设置，MCP功能将不可用`, 'warn');
        return;
      }
      
      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
      log(`WebSearchService: Gemini API初始化成功`);
    } catch (error) {
      log(`WebSearchService: Gemini API初始化失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      this.genAI = null;
    }
  }

  /**
   * 设置是否启用缓存
   * @param enabled 是否启用
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    log(`WebSearchService 缓存已${enabled ? '开启' : '关闭'}`);
  }

  /**
   * 设置缓存过期时间
   * @param minutes 过期时间（分钟）
   */
  setCacheExpiryMinutes(minutes: number): void {
    if (minutes > 0) {
      this.cacheExpiryMinutes = minutes;
      log(`WebSearchService 缓存时间已设置为 ${minutes} 分钟`);
    }
  }
  
  /**
   * 设置是否启用MCP处理
   * @param enabled 是否启用
   */
  setMCPEnabled(enabled: boolean): void {
    this.mcpEnabled = enabled;
    log(`WebSearchService MCP处理已${enabled ? '开启' : '关闭'}`);
  }
  
  /**
   * 设置内容价值评估阈值
   * @param threshold 阈值 (0-1)
   */
  setContentValueThreshold(threshold: number): void {
    this.contentValueThreshold = Math.max(0, Math.min(1, threshold));
    log(`WebSearchService 内容价值阈值已设置为 ${this.contentValueThreshold}`);
  }

  /**
   * 执行网络搜索
   * @param query 搜索查询
   * @returns 搜索结果摘要数组
   */
  async search(query: string): Promise<SearchSnippet[]> {
    try {
      if (!query) {
        log(`搜索查询为空，无法执行搜索`);
        return [];
      }
      
      // 如果启用了缓存，先尝试从缓存中获取
      if (this.cacheEnabled) {
        const cachedResult = await storage.getSearchResult(query);
        if (cachedResult) {
          log(`使用缓存的搜索结果: ${query}`);
          return cachedResult.results as SearchSnippet[];
        }
      }
      
      // 没有缓存，执行实际搜索
      if (!this.apiKey) {
        log(`搜索API密钥未设置，无法执行搜索`);
        throw new Error("Search API key is not configured");
      }
      
      log(`执行搜索: ${query}`);
      
      const response = await fetch(this.searchEndpoint, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          q: query,
          gl: "cn", // 地区设置为中国
          hl: "zh-cn", // 语言设置为中文
          num: 10 // 搜索结果数量
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`搜索API错误 (${response.status}): ${errorText}`);
        throw new Error(`Search API error: ${response.status}`);
      }
      
      const searchData = await response.json() as any;
      
      // 解析搜索结果
      const snippets: SearchSnippet[] = [];
      
      // 处理自然搜索结果
      if (searchData.organic && Array.isArray(searchData.organic)) {
        for (const result of searchData.organic) {
          snippets.push({
            title: result.title || "",
            snippet: result.snippet || "",
            url: result.link || ""
          });
        }
      }
      
      // 处理知识面板结果（如果有）
      if (searchData.knowledgeGraph) {
        const kg = searchData.knowledgeGraph;
        snippets.push({
          title: kg.title || "知识面板",
          snippet: kg.description || "",
          url: kg.descriptionLink || ""
        });
      }
      
      // 处理相关问题（如果有）
      if (searchData.relatedSearches && Array.isArray(searchData.relatedSearches)) {
        const relatedQuestions = searchData.relatedSearches
          .slice(0, 3) // 只取前3个相关问题
          .map((q: any) => q.query)
          .join(", ");
        
        if (relatedQuestions) {
          snippets.push({
            title: "相关问题",
            snippet: relatedQuestions,
            url: ""
          });
        }
      }
      
      log(`搜索完成，获取到 ${snippets.length} 条结果`);
      
      // 如果启用了缓存，将结果保存到缓存
      if (this.cacheEnabled && snippets.length > 0) {
        await storage.saveSearchResult(query, snippets, this.cacheExpiryMinutes);
        log(`搜索结果已缓存，过期时间 ${this.cacheExpiryMinutes} 分钟`);
      }
      
      return snippets;
    } catch (error) {
      log(`搜索错误: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * 使用自定义的结构化搜索处理 (CustomMCP) 执行增强搜索
   * 返回结构化搜索结果，无需生成嵌入
   * @param query 搜索查询
   * @returns 结构化搜索结果
   */
  async searchWithMCP(query: string): Promise<CustomMCPSearchResult | null> {
    try {
      if (!query || query.trim().length === 0) {
        log(`MCP搜索查询为空，无法执行`);
        return null;
      }
      
      // 检查MCP是否启用
      if (!this.mcpEnabled) {
        log(`MCP搜索功能已禁用`);
        return null;
      }
      
      // 检查Gemini API是否可用
      if (!this.genAI) {
        log(`MCP搜索需要Gemini API，但API未初始化`);
        return null;
      }
      
      // 生成缓存键
      const cacheKey = this.generateCacheKey(query);
      
      // 检查MCP缓存
      const cachedResult = this.getMCPFromCache(cacheKey);
      if (cachedResult) {
        log(`使用MCP缓存的搜索结果: ${query}`);
        return cachedResult;
      }
      
      // 执行常规搜索获取原始结果
      const snippets = await this.search(query);
      
      if (!snippets || snippets.length === 0) {
        log(`MCP搜索未找到结果: ${query}`);
        return null;
      }
      
      // 使用Gemini模型处理搜索结果，生成结构化数据
      const mcpResult = await this.processMCPResult(query, snippets);
      if (!mcpResult) {
        log(`MCP处理失败: ${query}`);
        return null;
      }
      
      // 缓存结果
      this.saveMCPToCache(cacheKey, mcpResult);
      
      return mcpResult;
    } catch (error) {
      log(`MCP搜索错误: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * 使用Gemini处理自定义结构化搜索结果 (CustomMCP)
   * @param query 搜索查询
   * @param snippets 原始搜索结果
   * @returns 结构化CustomMCP结果
   */
  private async processMCPResult(
    query: string,
    snippets: SearchSnippet[]
  ): Promise<CustomMCPSearchResult | null> {
    try {
      // 构建Gemini模型
      const model = this.genAI!.getGenerativeModel({
        model: "gemini-2.0-flash", // 使用轻量级模型，降低成本
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
      
      // 将搜索结果转换为文本
      const searchContext = this.formatSearchContextForMCP(snippets);
      
      // 构建提示词
      const prompt = `
您是一个专业级搜索内容分析专家，请仔细分析用户的意图和搜索结果，提供高度相关的结构化信息。

搜索查询: "${query}"

搜索结果:
${searchContext}

您的任务包括三个步骤:
1. 首先分析用户查询的真实意图和需求。考虑：
   - 用户可能想要找什么具体信息？
   - 什么结果最符合他们需要解决的问题？
   - 用户最可能想要哪类事实信息、学术内容或专业观点？

2. 评估每个来源的质量和可信度，使用以下标准：
   - 高质量来源(8-10分)：学术论文(如arXiv)、科学期刊、大学网站、政府机构、知名研究机构、专业文档
   - 中等质量来源(5-7分)：知名新闻媒体、行业网站、主流博客、官方文档
   - 低质量来源(1-4分)：社交媒体帖子、营销网站、百度百家号、内容农场、无作者标识的文章
   - 应完全忽略的来源(0分)：明显包含虚假信息、纯广告内容、标题党网站

3. 基于对用户意图的理解和来源质量评估，选择最相关且高质量的内容，然后以JSON格式输出：

{
  "userIntent": "对用户意图的简洁准确理解，不超过30字",
  "summary": "基于用户真实意图的搜索结果综合摘要，优先选择高质量来源，简洁但包含关键事实和信息，不超过100字",
  "relevance": "搜索结果整体与用户需求的相关性评分，只使用1-10的整数，高度相关为8-10，一般相关为5-7，几乎不相关为1-4",
  "keyPoints": ["与用户意图高度相关的关键信息点1", "关键信息点2", ...], // 3-5个最相关要点，优先从高质量来源提取
  "sources": [
    {
      "title": "来源标题",
      "url": "URL地址",
      "content": "简要内容摘录，选择与用户意图最相关的部分",
      "relevanceToIntent": "特定来源与用户意图的相关性分数(1-10)",
      "sourceQuality": "来源质量评分(1-10)"
    },
    ...
  ] // 仅包含3个最相关且高质量的来源，按相关性和质量排序
}

重要指导原则：
1. 优先选择学术、专业和权威来源(arXiv、知名大学、研究机构)
2. 完全忽略低质量内容农场和营销号(如百度百家号、内容聚合网站)
3. 确保仅选择与用户真实意图高度相关的内容，而不是仅与搜索词表面相关的内容
4. 优先保留有实质性信息内容的来源，而不是纯推广或转载内容`;

      // 发送请求到模型
      const response = await model.generateContent({
        contents: [{
          role: 'user' as const,
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        }
      });
      
      const result = response.response;
      const textResponse = result.text();
      
      // 解析JSON响应
      const mcpData = this.parseJsonResponse(textResponse);
      if (!mcpData) {
        throw new Error("无法解析MCP结果");
      }
      
      // 构建自定义结构化搜索结果 (CustomMCP)
      const mcpResult: CustomMCPSearchResult = {
        query,
        userIntent: mcpData.userIntent || `了解关于"${query}"的信息`,
        summary: mcpData.summary || `关于"${query}"的搜索结果`,
        relevance: this.normalizeRelevanceScore(mcpData.relevance),
        keyPoints: Array.isArray(mcpData.keyPoints) ? mcpData.keyPoints : [],
        sources: Array.isArray(mcpData.sources) ? 
          mcpData.sources.map((source: {
            title: string;
            url: string;
            content: string;
            relevanceToIntent?: any;
            sourceQuality?: any;
          }) => ({
            ...source,
            // 确保relevanceToIntent字段存在
            relevanceToIntent: source.relevanceToIntent ? 
              this.normalizeRelevanceScore(source.relevanceToIntent) : 
              undefined,
            // 确保sourceQuality字段存在
            sourceQuality: source.sourceQuality ? 
              this.normalizeRelevanceScore(source.sourceQuality) : 
              undefined
          })) : 
          [],
        timestamp: Date.now()
      };
      
      return mcpResult;
    } catch (error) {
      log(`MCP处理错误: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * 评估内容价值
   * 使用轻量级Gemini模型快速分析内容价值
   * @param content 待评估内容
   * @returns 内容价值评估结果
   */
  private async assessContentValue(content: string): Promise<ContentValueAssessment> {
    try {
      // 如果Gemini API不可用，默认认为有价值
      if (!this.genAI) {
        return {
          isValuable: true,
          score: 0.7,
          reason: "API未初始化，假定内容有价值"
        };
      }
      
      // 内容太短，不评估
      if (content.trim().length < 15) {
        return {
          isValuable: false,
          score: 0.2,
          reason: "内容太短"
        };
      }
      
      // 构建Gemini模型
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash", // 使用轻量级模型
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
      
      // 截断内容，防止过长
      const truncatedContent = content.length > 1000 ? 
                             content.substring(0, 1000) + "..." : 
                             content;
      
      // 构建提示词
      const prompt = `
分析以下内容，判断是否包含实质性的教育价值。
评估标准:
1. 信息密度 - 内容包含的信息点数量
2. 知识深度 - 涉及概念的复杂度和深度
3. 教育价值 - 内容对学习的帮助程度

内容:
${truncatedContent}

请以JSON格式回复:
{
  "isValuable": true/false,
  "score": 0到1之间的评分,
  "reason": "简要解释评分原因，20字以内"
}`;

      // 发送请求到模型
      const result = await model.generateContent({
        contents: [{
          role: 'user' as const,
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 256,
          responseMimeType: "application/json"
        }
      });
      
      const response = result.response;
      const textResponse = response.text();
      
      // 解析JSON响应
      const jsonResult = this.parseJsonResponse(textResponse);
      if (!jsonResult) {
        return {
          isValuable: true,
          score: 0.5,
          reason: "解析失败，默认有价值"
        };
      }
      
      // 构建评估结果
      return {
        isValuable: Boolean(jsonResult.isValuable),
        score: typeof jsonResult.score === 'number' ? 
               Math.max(0, Math.min(1, jsonResult.score)) : 0.5,
        reason: jsonResult.reason || '未提供原因'
      };
    } catch (error) {
      log(`内容价值评估错误: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValuable: true, 
        score: 0.6,
        reason: "评估出错，默认有价值"
      };
    }
  }
  
  /**
   * 解析JSON响应
   * 兼容多种格式的JSON输出
   * @param text JSON文本
   * @returns 解析后的对象
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
      
      log(`无法解析JSON响应: ${text.substring(0, 100)}...`, 'warn');
      return null;
    }
  }
  
  /**
   * 规范化相关性评分
   * @param score 原始评分
   * @returns 规范化的评分 (1-10)
   */
  private normalizeRelevanceScore(score: any): number {
    if (typeof score === 'number') {
      return Math.max(1, Math.min(10, Math.round(score)));
    }
    
    if (typeof score === 'string') {
      const parsed = parseInt(score, 10);
      if (!isNaN(parsed)) {
        return Math.max(1, Math.min(10, parsed));
      }
    }
    
    return 5; // 默认中等相关性
  }
  
  /**
   * 生成MCP缓存键
   * @param query 查询字符串
   * @returns 缓存键
   */
  private generateCacheKey(query: string): string {
    // 简单的哈希函数
    let hash = 0;
    const str = query.toLowerCase().trim();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `mcp_${Math.abs(hash).toString(16)}`;
  }
  
  /**
   * 从缓存获取自定义结构化搜索结果 (CustomMCP)
   * @param cacheKey 缓存键
   * @returns 缓存的结果或null
   */
  private getMCPFromCache(cacheKey: string): CustomMCPSearchResult | null {
    const entry = this.mcpCache.get(cacheKey);
    
    if (entry && entry.expiresAt > Date.now()) {
      return entry.result;
    }
    
    // 删除过期缓存
    if (entry) {
      this.mcpCache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * 保存自定义结构化搜索结果到缓存 (CustomMCP)
   * @param cacheKey 缓存键
   * @param result 结构化搜索结果
   */
  private saveMCPToCache(cacheKey: string, result: CustomMCPSearchResult): void {
    // 如果缓存已满，删除最旧的条目
    if (this.mcpCache.size >= this.mcpCacheSize) {
      let oldestKey = '';
      let oldestTime = Infinity;
      
      // 使用Array.from避免迭代器兼容性问题
      Array.from(this.mcpCache.entries()).forEach(([key, entry]) => {
        if (entry.expiresAt < oldestTime) {
          oldestTime = entry.expiresAt;
          oldestKey = key;
        }
      });
      
      if (oldestKey) {
        this.mcpCache.delete(oldestKey);
      }
    }
    
    // 计算过期时间
    const expiresAt = Date.now() + (this.cacheExpiryMinutes * 60 * 1000);
    
    // 添加到缓存
    this.mcpCache.set(cacheKey, {
      query: result.query,
      result,
      expiresAt
    });
  }
  
  /**
   * 为MCP处理格式化搜索上下文
   * @param snippets 搜索结果摘要
   * @returns 格式化的上下文文本
   */
  private formatSearchContextForMCP(snippets: SearchSnippet[]): string {
    let context = "";
    
    snippets.forEach((snippet, index) => {
      context += `--- 结果 ${index + 1} ---\n`;
      context += `标题: ${snippet.title}\n`;
      context += `摘要: ${snippet.snippet}\n`;
      if (snippet.url) {
        context += `URL: ${snippet.url}\n`;
      }
      context += "\n";
    });
    
    return context;
  }

  /**
   * 将搜索结果格式化为提示词上下文
   * @param snippets 搜索结果摘要数组
   * @returns 格式化的上下文文本
   */
  formatSearchContext(snippets: SearchSnippet[]): string {
    if (!snippets || snippets.length === 0) {
      return "";
    }
    
    // 使用参考架构中的格式，用【SEARCH-RESULTS】和【END-SEARCH】作为边界标记
    let context = "【SEARCH-RESULTS】\n";
    
    snippets.forEach((snippet, index) => {
      context += `--- 结果 ${index + 1} ---\n`;
      context += `标题: ${snippet.title}\n`;
      context += `摘要: ${snippet.snippet}\n`;
      if (snippet.url) {
        context += `URL: ${snippet.url}\n`;
      }
      context += "\n";
    });
    
    context += "【END-SEARCH】\n";
    
    return context;
  }
  
  /**
   * 使用自定义结构化搜索结果格式化提示词上下文 (CustomMCP)
   * 适用于结构化CustomMCP搜索结果
   * @param mcpResult 自定义结构化搜索结果
   * @returns 格式化的提示词上下文
   */
  formatMCPSearchContext(mcpResult: CustomMCPSearchResult): string {
    if (!mcpResult) {
      return "";
    }
    
    let context = "以下是从网络搜索中获取的相关信息：\n\n";
    
    // 添加用户意图（如果有）
    if (mcpResult.userIntent) {
      context += `查询意图：${mcpResult.userIntent}\n\n`;
    }
    
    // 添加综合摘要
    context += `综合摘要：${mcpResult.summary}\n\n`;
    
    // 添加关键信息点
    if (mcpResult.keyPoints && mcpResult.keyPoints.length > 0) {
      context += "主要信息点：\n";
      mcpResult.keyPoints.forEach((point: string, index: number) => {
        context += `• ${point}\n`;
      });
      context += "\n";
    }
    
    // 添加来源信息
    if (mcpResult.sources && mcpResult.sources.length > 0) {
      context += "详细信息来源：\n";
      mcpResult.sources.forEach((source: {
        title: string; 
        url: string; 
        content: string;
        relevanceToIntent?: number;
        sourceQuality?: number;
      }, index: number) => {
        // 来源标题显示质量评分（如果有）
        if (source.sourceQuality) {
          context += `[${index + 1}] ${source.title} (质量评分: ${source.sourceQuality}/10)\n`;
        } else {
          context += `[${index + 1}] ${source.title}\n`;
        }
        
        context += `${source.content}\n`;
        
        if (source.url) {
          context += `来源: ${source.url}\n`;
        }
        
        if (source.relevanceToIntent) {
          context += `相关性: ${source.relevanceToIntent}/10\n`;
        }
        
        context += "\n";
      });
    }
    
    context += "请根据以上信息和您的知识来回答问题。如果引用特定信息，可以标注来源编号，例如[1]。\n";
    
    return context;
  }

  /**
   * 清理过期的搜索缓存
   * @returns 清理的记录数
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      // 清理数据库缓存
      const deletedCount = await storage.deleteExpiredSearchResults();
      log(`已清理 ${deletedCount} 条过期搜索缓存`);
      
      // 清理MCP内存缓存
      let mcpDeletedCount = 0;
      const now = Date.now();
      
      // 使用Array.from避免迭代器兼容性问题
      Array.from(this.mcpCache.entries()).forEach(([key, entry]) => {
        if (entry.expiresAt < now) {
          this.mcpCache.delete(key);
          mcpDeletedCount++;
        }
      });
      
      if (mcpDeletedCount > 0) {
        log(`已清理 ${mcpDeletedCount} 条过期MCP缓存`);
      }
      
      return deletedCount + mcpDeletedCount;
    } catch (error) {
      log(`清理搜索缓存错误: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
  
  /**
   * 检查内容是否值得向量化
   * @param content 文本内容
   * @returns 是否应该向量化
   */
  async shouldVectorize(content: string): Promise<boolean> {
    // 内容太短，不值得向量化
    if (!content || content.trim().length < 10) {
      return false;
    }
    
    // 评估内容价值
    const assessment = await this.assessContentValue(content);
    
    // 分数低于阈值，不向量化
    if (assessment.score < this.contentValueThreshold) {
      log(`内容不值得向量化: ${assessment.reason}, 分数=${assessment.score}`);
      return false;
    }
    
    return true;
  }
}

// 导出单例实例
export const webSearchService = new WebSearchService();