/**
 * Anthropic Claude服务
 * 使用Anthropic SDK的MCP (Message Content Protocol)实现高效内容处理
 */

import Anthropic from '@anthropic-ai/sdk';

// 检查环境变量
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Anthropic服务类
 * 实现基于Claude模型的内容分析和生成
 */
export class AnthropicService {
  private client: Anthropic | null = null;
  private initialized: boolean = false;
  
  constructor() {
    this.init();
  }
  
  /**
   * 初始化Anthropic客户端
   */
  private init(): void {
    if (!ANTHROPIC_API_KEY) {
      console.warn('[AnthropicService] ANTHROPIC_API_KEY未设置，Claude功能将不可用');
      return;
    }
    
    try {
      this.client = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
      });
      this.initialized = true;
      console.log('[AnthropicService] Claude API初始化成功');
    } catch (error) {
      console.error('[AnthropicService] 初始化错误:', error);
    }
  }
  
  /**
   * 检查服务是否可用
   */
  public isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }
  
  /**
   * 使用Claude模型分析内容价值
   * 快速确定内容是否值得生成向量嵌入
   * @param content 要分析的内容
   * @returns 包含价值评分的分析结果
   */
  public async analyzeContentValue(content: string): Promise<{
    isValuable: boolean;
    score: number;
    reason: string;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic服务未初始化');
    }
    
    try {
      const response = await this.client!.messages.create({
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 1024,
        system: `您是内容价值评估专家。您的任务是分析给定内容，判断其是否包含有实质教育价值的信息，是否值得生成向量嵌入用于长期记忆。
        
评估标准:
1. 信息密度 - 内容包含有多少可学习的信息点
2. 知识深度 - 内容涉及的概念或知识的复杂度和深度
3. 教育价值 - 内容是否有助于学习或理解某个领域
4. 长期参考价值 - 内容是否值得长期保存并在未来检索

忽略以下类型内容:
- 简单问候、打招呼
- 简短测试消息
- 无实质内容的闲聊
- 简单的是/否回答，没有解释
- 纯粹的情绪表达，如"我很高兴"

请以JSON格式返回，包含以下字段:
- isValuable: boolean (内容是否有价值)
- score: number (0-1评分，表示价值程度)
- reason: string (简要解释评分原因)`,
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.content[0].text);
      return {
        isValuable: result.isValuable,
        score: Math.max(0, Math.min(1, result.score)), // 确保分数在0-1之间
        reason: result.reason
      };
    } catch (error) {
      console.error('[AnthropicService] 内容价值分析错误:', error);
      // 默认将内容视为有价值，以防错误导致重要内容被忽略
      return {
        isValuable: true,
        score: 0.5,
        reason: '分析过程中发生错误，默认将内容视为中等价值'
      };
    }
  }
  
  /**
   * 使用Claude进行基于MCP的网络搜索内容处理
   * @param query 搜索查询
   * @param searchResults 搜索结果数组
   * @returns 处理后的摘要和分析
   */
  public async processSearchResults(
    query: string, 
    searchResults: Array<{ title: string; content: string; url: string }>
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic服务未初始化');
    }
    
    try {
      // 使用MCP构建结构化内容块
      const contentBlocks = [];
      
      // 添加用户查询块
      contentBlocks.push({
        type: 'text',
        text: `我的搜索查询是: "${query}"`
      });
      
      // 添加搜索结果块
      searchResults.forEach((result, index) => {
        contentBlocks.push({
          type: 'text',
          text: `[结果 ${index + 1}]\n标题: ${result.title}\nURL: ${result.url}\n内容:\n${result.content}\n`
        });
      });
      
      const response = await this.client!.messages.create({
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 1500,
        system: `您是一位专业的研究助手，负责分析和整合搜索结果。
        
请根据用户的查询和提供的搜索结果，创建一份全面、准确、客观的摘要。您的回应应该:

1. 整合多个来源的信息，保持客观性
2. 强调与用户查询最相关的信息
3. 指出信息来源之间的任何矛盾或差异
4. 列出最重要的3-5个要点
5. 如果搜索结果中缺乏足够信息，请明确指出

请使用简明清晰的语言，避免冗长，直接回答用户的查询。`,
        messages: [
          {
            role: 'user',
            content: contentBlocks
          }
        ]
      });
      
      return response.content[0].text;
    } catch (error) {
      console.error('[AnthropicService] 搜索结果处理错误:', error);
      throw error;
    }
  }
  
  /**
   * 分析对话文本，确定学习阶段
   * 使用KWLQ框架(Know-Want-Learn-Question)
   * @param messageHistory 消息历史
   * @returns 学习阶段识别结果
   */
  public async analyzeConversationPhase(messageHistory: Array<{role: string; content: string}>): Promise<{
    phase: 'K' | 'W' | 'L' | 'Q';
    confidence: number;
    explanation: string;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic服务未初始化');
    }
    
    try {
      // 使用MCP构建对话历史
      const contentBlocks = messageHistory.map(msg => ({
        type: 'text',
        text: `[${msg.role.toUpperCase()}]: ${msg.content}`
      }));
      
      const response = await this.client!.messages.create({
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 1024,
        system: `您是对话分析专家，使用KWLQ框架分析学习阶段:

K (Knowledge): 用户展示已有知识，陈述已知信息，或表明理解某概念
W (Want): 用户表达学习意愿，设定目标，询问如何学习
L (Learning): 用户处于积极学习状态，吸收新知识，提出澄清问题
Q (Question): 用户提出深入问题，挑战概念，寻求更高层次理解

请分析对话，判断用户当前处于哪个阶段。以JSON格式返回:
{
  "phase": 字符串, // "K", "W", "L" 或 "Q"
  "confidence": 数字, // 0到1之间的置信度
  "explanation": 字符串 // 简短解释
}`,
        messages: [
          {
            role: 'user',
            content: contentBlocks
          }
        ],
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.content[0].text);
      return {
        phase: result.phase as 'K' | 'W' | 'L' | 'Q',
        confidence: Math.max(0, Math.min(1, result.confidence)),
        explanation: result.explanation
      };
    } catch (error) {
      console.error('[AnthropicService] 对话阶段分析错误:', error);
      // 默认返回学习阶段
      return {
        phase: 'L',
        confidence: 0.5,
        explanation: '分析过程中发生错误，默认为学习阶段'
      };
    }
  }
}

// 导出单例实例
export const anthropicService = new AnthropicService();