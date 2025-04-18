/**
 * 网络搜索服务
 * 基于MCP协议实现的搜索功能
 */

import fetch from "node-fetch";
import { storage } from "../storage";
import { log } from "../vite";

/**
 * 搜索结果摘要接口
 */
export interface SearchSnippet {
  title: string;
  snippet: string;
  url: string;
}

/**
 * 搜索服务类
 */
export class WebSearchService {
  private apiKey: string;
  private searchEndpoint: string;
  private cacheEnabled: boolean;
  private cacheExpiryMinutes: number;

  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || "";
    this.searchEndpoint = "https://google.serper.dev/search";
    this.cacheEnabled = true; // 默认启用缓存
    this.cacheExpiryMinutes = 60; // 默认缓存1小时
    
    log(`WebSearchService 初始化，缓存${this.cacheEnabled ? '开启' : '关闭'}`);
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
   * 将搜索结果格式化为提示词上下文
   * @param snippets 搜索结果摘要数组
   * @returns 格式化的上下文文本
   */
  formatSearchContext(snippets: SearchSnippet[]): string {
    if (!snippets || snippets.length === 0) {
      return "";
    }
    
    let context = "以下是从网络搜索中获取的相关信息：\n\n";
    
    snippets.forEach((snippet, index) => {
      context += `[${index + 1}] ${snippet.title}\n`;
      context += `${snippet.snippet}\n`;
      if (snippet.url) {
        context += `来源: ${snippet.url}\n`;
      }
      context += "\n";
    });
    
    context += "请根据以上信息和您的知识来回答问题。如果引用特定信息，可以标注来源编号，例如[1]。\n";
    
    return context;
  }

  /**
   * 清理过期的搜索缓存
   * @returns 清理的记录数
   */
  async cleanupExpiredCache(): Promise<number> {
    try {
      const deletedCount = await storage.deleteExpiredSearchResults();
      log(`已清理 ${deletedCount} 条过期搜索缓存`);
      return deletedCount;
    } catch (error) {
      log(`清理搜索缓存错误: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}

// 导出单例实例
export const webSearchService = new WebSearchService();