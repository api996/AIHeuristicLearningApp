/**
 * 优化的对话分析服务
 * 使用Anthropic的MCP提供高效对话阶段分析
 */

import { anthropicService } from './anthropic-service';

// 对话阶段类型
export type ConversationPhase = 'K' | 'W' | 'L' | 'Q';

// 对话阶段说明
const phaseDescriptions = {
  K: '知识展示阶段：用户正在分享或确认已有知识',
  W: '学习意愿阶段：用户表达学习新知识的兴趣和意愿',
  L: '学习吸收阶段：用户正在接受和吸收新知识',
  Q: '深度提问阶段：用户提出深入问题以加强理解'
};

// 缓存对话分析结果
const analysisCache: Map<string, {
  timestamp: number;
  result: {
    phase: ConversationPhase;
    confidence: number;
    explanation: string;
  }
}> = new Map();

// 缓存过期时间 (10分钟)
const CACHE_TTL = 10 * 60 * 1000;

/**
 * 优化的对话分析服务类
 */
export class OptimizedConversationAnalysis {
  private cacheEnabled: boolean = true;
  
  constructor() {
    console.log('[OptimizedConversationAnalysis] 初始化完成');
  }
  
  /**
   * 分析对话阶段
   * @param messages 消息历史
   * @returns 对话阶段分析结果
   */
  public async analyzePhase(
    messages: Array<{role: string; content: string}>
  ): Promise<{
    phase: ConversationPhase;
    confidence: number;
    explanation: string;
    description: string;
  }> {
    // 检查消息历史是否为空
    if (!messages || messages.length === 0) {
      console.log('[OptimizedConversationAnalysis] 消息历史为空，默认为学习意愿阶段');
      return {
        phase: 'W',
        confidence: 1.0,
        explanation: '没有提供消息历史，默认处于学习意愿阶段',
        description: phaseDescriptions['W']
      };
    }
    
    // 使用最后3条消息生成缓存键
    const lastMessages = messages.slice(-3);
    const cacheKey = this.generateCacheKey(lastMessages);
    
    // 检查缓存
    if (this.cacheEnabled) {
      const cachedAnalysis = this.getCachedAnalysis(cacheKey);
      if (cachedAnalysis) {
        console.log('[OptimizedConversationAnalysis] 使用缓存的分析结果');
        return {
          ...cachedAnalysis,
          description: phaseDescriptions[cachedAnalysis.phase]
        };
      }
    }
    
    // 检查Anthropic服务是否可用
    if (!anthropicService.isAvailable()) {
      console.log('[OptimizedConversationAnalysis] Anthropic服务不可用，使用备用分析');
      return this.fallbackAnalysis(messages);
    }
    
    try {
      // 使用Anthropic的MCP分析对话
      const analysis = await anthropicService.analyzeConversationPhase(messages);
      
      // 更新缓存
      if (this.cacheEnabled) {
        this.cacheAnalysis(cacheKey, analysis);
      }
      
      // 返回结果
      return {
        ...analysis,
        description: phaseDescriptions[analysis.phase]
      };
    } catch (error) {
      console.error('[OptimizedConversationAnalysis] 分析错误:', error);
      return this.fallbackAnalysis(messages);
    }
  }
  
  /**
   * 备用分析方法
   * 当Claude API不可用时使用
   * @param messages 消息历史
   * @returns 分析结果
   */
  private fallbackAnalysis(
    messages: Array<{role: string; content: string}>
  ): {
    phase: ConversationPhase;
    confidence: number;
    explanation: string;
    description: string;
  } {
    // 分析最后一条用户消息
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    
    if (!lastUserMessage) {
      // 没有用户消息，默认为学习意愿阶段
      return {
        phase: 'W',
        confidence: 0.7,
        explanation: '没有用户消息，默认为学习意愿阶段',
        description: phaseDescriptions['W']
      };
    }
    
    const content = lastUserMessage.content.toLowerCase();
    
    // 简单的关键词匹配
    if (content.includes('?') || content.includes('为什么') || content.includes('如何') || content.includes('什么是')) {
      // 提问
      return {
        phase: 'Q',
        confidence: 0.8,
        explanation: '用户提出疑问或问题',
        description: phaseDescriptions['Q']
      };
    } else if (content.includes('学习') || content.includes('想知道') || content.includes('想了解') || content.includes('帮我')) {
      // 学习意愿
      return {
        phase: 'W',
        confidence: 0.8,
        explanation: '用户表达了学习意愿',
        description: phaseDescriptions['W']
      };
    } else if (content.includes('我知道') || content.includes('我认为') || content.includes('我理解')) {
      // 知识展示
      return {
        phase: 'K',
        confidence: 0.8,
        explanation: '用户在分享自己的知识或理解',
        description: phaseDescriptions['K']
      };
    } else {
      // 默认为学习吸收阶段
      return {
        phase: 'L',
        confidence: 0.6,
        explanation: '未检测到明确意图，假定用户正在吸收信息',
        description: phaseDescriptions['L']
      };
    }
  }
  
  /**
   * 生成缓存键
   * @param messages 消息历史
   * @returns 缓存键
   */
  private generateCacheKey(messages: Array<{role: string; content: string}>): string {
    // 使用消息内容的哈希作为缓存键
    const contentString = messages.map(m => `${m.role}:${m.content}`).join('|');
    
    // 简单哈希函数
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
      const char = contentString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `phase_${hash.toString(16)}`;
  }
  
  /**
   * 从缓存获取分析结果
   * @param key 缓存键
   * @returns 缓存的分析结果或undefined
   */
  private getCachedAnalysis(key: string): {
    phase: ConversationPhase;
    confidence: number;
    explanation: string;
  } | undefined {
    const cachedData = analysisCache.get(key);
    
    // 检查缓存是否存在且未过期
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      return cachedData.result;
    }
    
    // 缓存不存在或已过期
    return undefined;
  }
  
  /**
   * 缓存分析结果
   * @param key 缓存键
   * @param result 分析结果
   */
  private cacheAnalysis(
    key: string, 
    result: {
      phase: ConversationPhase;
      confidence: number;
      explanation: string;
    }
  ): void {
    // 缓存分析结果
    analysisCache.set(key, {
      timestamp: Date.now(),
      result
    });
    
    // 如果缓存过大，清除最旧的项
    if (analysisCache.size > 100) {
      let oldestKey = '';
      let oldestTime = Date.now();
      
      analysisCache.forEach((value, key) => {
        if (value.timestamp < oldestTime) {
          oldestTime = value.timestamp;
          oldestKey = key;
        }
      });
      
      if (oldestKey) {
        analysisCache.delete(oldestKey);
      }
    }
  }
  
  /**
   * 启用或禁用缓存
   * @param enabled 是否启用缓存
   */
  public setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    console.log(`[OptimizedConversationAnalysis] 缓存${enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 清除所有缓存的分析结果
   */
  public clearCache(): void {
    analysisCache.clear();
    console.log('[OptimizedConversationAnalysis] 缓存已清除');
  }
}

// 导出服务单例
export const optimizedConversationAnalysis = new OptimizedConversationAnalysis();