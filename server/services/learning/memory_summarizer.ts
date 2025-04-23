/**
 * 记忆摘要服务
 * 负责为记忆生成摘要和提取关键词
 */

import { log } from "../../vite";
import { genAiService } from "../genai/genai_service";

export class MemorySummarizerService {
  /**
   * 为文本生成摘要
   * @param text 输入文本
   * @returns 生成的摘要
   */
  async summarizeText(text: string): Promise<string | null> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        log('[memory_summarizer] 无法为空文本生成摘要', 'warn');
        return null;
      }

      // 如果文本非常短，直接使用原文
      if (text.length < 50) {
        return text;
      }

      // 使用GenAI服务生成摘要
      const summary = await genAiService.generateSummary(text);
      
      if (!summary) {
        // 后备方案：使用文本的前部分
        const fallbackSummary = text.slice(0, 100).trim() + (text.length > 100 ? '...' : '');
        log('[memory_summarizer] 使用文本截断作为后备摘要', 'warn');
        return fallbackSummary;
      }

      return summary;
    } catch (error) {
      log(`[memory_summarizer] 生成摘要时出错: ${error}`, 'error');
      // 后备方案
      return text.slice(0, 100).trim() + (text.length > 100 ? '...' : '');
    }
  }

  /**
   * 从文本中提取关键词
   * @param text 输入文本
   * @returns 关键词数组
   */
  async extractKeywords(text: string): Promise<string[] | null> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        log('[memory_summarizer] 无法从空文本提取关键词', 'warn');
        return null;
      }

      // 文本太短时使用简单方法
      if (text.length < 50) {
        const words = text.split(/\s+/).filter(w => w.length >= 2);
        return words.slice(0, 5);
      }

      // 使用GenAI服务提取关键词
      const keywords = await genAiService.extractKeywords(text);
      
      if (!keywords || keywords.length === 0) {
        // 后备方案：使用简单的词频统计
        log('[memory_summarizer] 使用简单分词作为后备关键词提取', 'warn');
        const commonWords = new Set(['的', '是', '在', '了', '和', '有', '与', '又', '也', 'the', 'is', 'a', 'an', 'of', 'to', 'in', 'for']);
        
        // 简单分词
        const words = text.split(/[\s,，.。:：;；!！?？、]+/).filter(w => 
          w.length >= 2 && w.length <= 10 && !commonWords.has(w.toLowerCase())
        );
        
        // 计算词频
        const wordCounts = new Map<string, number>();
        for (const word of words) {
          const count = wordCounts.get(word) || 0;
          wordCounts.set(word, count + 1);
        }
        
        // 按频率排序并取前几个
        const sortedWords = Array.from(wordCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(entry => entry[0])
          .slice(0, 8);
        
        return sortedWords;
      }

      return keywords;
    } catch (error) {
      log(`[memory_summarizer] 提取关键词时出错: ${error}`, 'error');
      // 简单的后备方案
      const words = text.split(/\s+/).filter(w => w.length >= 2);
      return words.slice(0, 5);
    }
  }
  
  /**
   * 为聚类生成主题
   * @param text 聚类内容
   * @returns 生成的主题
   */
  async generateTopic(text: string): Promise<string | null> {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        log('[memory_summarizer] 无法为空文本生成主题', 'warn');
        return null;
      }

      // 如果文本非常短，直接使用原文
      if (text.length < 50) {
        return `主题: ${text.slice(0, 20)}`;
      }

      // 使用GenAI服务生成主题
      const topic = await genAiService.generateTopicForMemories([text]);
      
      if (!topic) {
        // 后备方案：使用关键词组合
        const keywords = await this.extractKeywords(text);
        if (keywords && keywords.length > 0) {
          const topKeywords = keywords.slice(0, 3).join('和');
          return `${topKeywords}相关主题`;
        }
        
        return `主题${Date.now().toString().slice(-4)}`;
      }

      return topic;
    } catch (error) {
      log(`[memory_summarizer] 生成主题时出错: ${error}`, 'error');
      // 后备方案
      return `主题${Date.now().toString().slice(-4)}`;
    }
  }
}

// 导出服务实例
export const memorySummarizer = new MemorySummarizerService();