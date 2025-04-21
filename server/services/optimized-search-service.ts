/**
 * 优化的搜索服务
 * 结合Anthropic MCP和智能嵌入生成，提供高效web搜索功能
 */

import axios from 'axios';
import { anthropicService } from './anthropic-service';
import { optimizedEmbeddingService } from './optimized-embedding-service';

// 缓存搜索结果，减少重复查询
const searchCache: Map<string, {
  timestamp: number;
  results: SearchResult[];
}> = new Map();

// 缓存过期时间 (1小时)
const CACHE_TTL = 60 * 60 * 1000;

// 搜索结果类型
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
}

/**
 * 优化的搜索服务类
 */
export class OptimizedSearchService {
  private serperApiKey: string | undefined;
  private cacheEnabled: boolean = true;
  
  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    console.log('[OptimizedSearchService] 初始化，缓存开启');
  }
  
  /**
   * 执行网络搜索
   * @param query 搜索查询
   * @param useCache 是否使用缓存
   * @returns 搜索结果
   */
  public async search(query: string, useCache: boolean = true): Promise<SearchResult[]> {
    // 规范化查询字符串
    const normalizedQuery = query.trim().toLowerCase();
    
    // 检查缓存
    if (useCache && this.cacheEnabled) {
      const cachedResults = this.getCachedResults(normalizedQuery);
      if (cachedResults) {
        console.log('[OptimizedSearchService] 使用缓存的搜索结果');
        return cachedResults;
      }
    }
    
    // 检查API密钥
    if (!this.serperApiKey) {
      console.error('[OptimizedSearchService] 搜索API密钥未设置');
      throw new Error('搜索API密钥未设置');
    }
    
    try {
      // 使用Serper API执行搜索
      const response = await axios.post(
        'https://google.serper.dev/search',
        { q: normalizedQuery },
        { 
          headers: { 
            'X-API-KEY': this.serperApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // 处理搜索结果
      const results: SearchResult[] = [];
      
      // 处理有机搜索结果
      if (response.data.organic) {
        for (const item of response.data.organic) {
          results.push({
            title: item.title || '',
            link: item.link || '',
            snippet: item.snippet || '',
            source: 'organic'
          });
        }
      }
      
      // 处理知识面板结果
      if (response.data.knowledgeGraph) {
        const kg = response.data.knowledgeGraph;
        results.push({
          title: kg.title || '',
          link: kg.link || '',
          snippet: kg.description || '',
          source: 'knowledge_graph'
        });
      }
      
      // 处理答案框结果
      if (response.data.answerBox) {
        const ab = response.data.answerBox;
        results.push({
          title: ab.title || '',
          link: ab.link || '',
          snippet: ab.snippet || ab.answer || '',
          source: 'answer_box'
        });
      }
      
      // 更新缓存
      if (this.cacheEnabled) {
        this.cacheResults(normalizedQuery, results);
      }
      
      return results;
    } catch (error) {
      console.error('[OptimizedSearchService] 搜索错误:', error);
      throw error;
    }
  }
  
  /**
   * 使用MCP执行增强搜索并处理结果
   * @param query 用户查询
   * @returns 处理好的搜索结果摘要
   */
  public async searchWithMCP(query: string): Promise<{
    summary: string;
    results: SearchResult[];
  }> {
    // 执行搜索
    const searchResults = await this.search(query);
    
    // 如果没有可用的Claude API，返回原始结果
    if (!anthropicService.isAvailable()) {
      console.log('[OptimizedSearchService] Anthropic服务不可用，返回原始结果');
      return {
        summary: "搜索已完成，但由于Claude API不可用，无法生成摘要。",
        results: searchResults
      };
    }
    
    try {
      // 将搜索结果转换为适合MCP的格式
      const formattedResults = searchResults.map(result => ({
        title: result.title,
        url: result.link,
        content: result.snippet
      }));
      
      // 使用Claude的MCP处理搜索结果
      const summary = await anthropicService.processSearchResults(query, formattedResults);
      
      // 返回处理后的结果
      return {
        summary,
        results: searchResults
      };
    } catch (error) {
      console.error('[OptimizedSearchService] MCP处理错误:', error);
      
      // 出错时返回原始结果
      return {
        summary: "搜索结果处理过程中发生错误，无法生成摘要。",
        results: searchResults
      };
    }
  }
  
  /**
   * 为搜索结果生成嵌入向量
   * 使用优化的嵌入服务，只为有价值的内容生成嵌入
   * @param results 搜索结果
   * @returns 嵌入向量数组
   */
  public async generateEmbeddingsForResults(
    results: SearchResult[]
  ): Promise<(number[] | null)[]> {
    // 提取内容
    const contents = results.map(result => {
      return `${result.title}. ${result.snippet}`;
    });
    
    // 批量生成嵌入
    return optimizedEmbeddingService.batchGenerateEmbeddings(contents);
  }
  
  /**
   * 从缓存获取搜索结果
   * @param query 搜索查询
   * @returns 缓存的搜索结果或undefined
   */
  private getCachedResults(query: string): SearchResult[] | undefined {
    const cachedData = searchCache.get(query);
    
    // 检查缓存是否存在且未过期
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      return cachedData.results;
    }
    
    // 缓存不存在或已过期
    return undefined;
  }
  
  /**
   * 缓存搜索结果
   * @param query 搜索查询
   * @param results 搜索结果
   */
  private cacheResults(query: string, results: SearchResult[]): void {
    // 缓存搜索结果
    searchCache.set(query, {
      timestamp: Date.now(),
      results
    });
    
    // 如果缓存过大，清除最旧的项
    if (searchCache.size > 100) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      searchCache.forEach((value, key) => {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      });
      
      if (oldestKey) {
        searchCache.delete(oldestKey);
      }
    }
  }
  
  /**
   * 启用或禁用缓存
   * @param enabled 是否启用缓存
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    console.log(`[OptimizedSearchService] 缓存${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 清除所有缓存的搜索结果
   */
  public clearCache(): void {
    searchCache.clear();
    console.log('[OptimizedSearchService] 缓存已清除');
  }
}

// 导出服务单例
export const optimizedSearchService = new OptimizedSearchService();