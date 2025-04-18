/**
 * 轻量级对话阶段分析服务
 * 使用Gemini-1.5-flash模型进行更快速的对话分析
 */

import { log } from "../vite";
import { storage } from "../storage";
import { type Message } from "../../shared/schema";
import fetch from "node-fetch";

export type ConversationPhase = "K" | "W" | "L" | "Q";

export interface PhaseAnalysisResult {
  currentPhase: ConversationPhase;
  summary: string;
  confidence: number;
}

/**
 * 轻量级对话阶段分析服务
 * 使用Gemini-1.5-flash模型对对话内容进行快速摘要和阶段识别
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
    // 使用更快速的gemini-1.5-flash模型
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    log("轻量级对话阶段分析服务初始化完成");
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
      return analytic?.phase || null;
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
   * 调用Gemini-1.5-flash进行对话分析
   * 使用更轻量级的模型以提高速度，减少超时
   * @param conversationText 对话文本
   * @returns 对话阶段分析结果
   */
  private async callGeminiForAnalysis(conversationText: string): Promise<PhaseAnalysisResult | null> {
    // 如果没有API密钥，使用关键词分析（零API调用）
    if (!this.apiKey) {
      log("没有Gemini API密钥，使用关键词分析替代");
      return this.backoffToKeywordAnalysis(conversationText);
    }

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
        const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeout); // 清除超时
        
        if (!response.ok) {
          const errorText = await response.text();
          log(`Gemini API错误: ${response.status} - ${errorText}`);
          return this.backoffToKeywordAnalysis(conversationText);
        }

        const data = await response.json();
        
        // 提取响应中的JSON文本
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        if (!jsonText) {
          log(`Gemini API返回空响应`);
          return this.backoffToKeywordAnalysis(conversationText);
        }
        
        try {
          // 解析响应中的JSON
          const parseResult = JSON.parse(jsonText);
          
          // 验证必要字段
          if (!parseResult.currentPhase || !["K", "W", "L", "Q"].includes(parseResult.currentPhase)) {
            log(`无效的对话阶段值: ${parseResult.currentPhase}`);
            return this.backoffToKeywordAnalysis(conversationText);
          }
          
          // 返回格式化的结果
          return {
            currentPhase: parseResult.currentPhase as ConversationPhase,
            summary: parseResult.summary || "对话分析",
            confidence: parseResult.confidence || 0.7
          };
        } catch (parseError) {
          log(`解析Gemini响应JSON失败: ${parseError}, 响应文本: ${jsonText}`);
          return this.backoffToKeywordAnalysis(conversationText);
        }
      } catch (fetchError) {
        clearTimeout(timeout); // 确保清除超时
        if (fetchError.name === 'AbortError') {
          log(`Gemini API请求超时`);
        } else {
          log(`Gemini API请求失败: ${fetchError}`);
        }
        return this.backoffToKeywordAnalysis(conversationText);
      }
    } catch (error) {
      log(`对话阶段分析失败: ${error}`);
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
}

// 创建服务实例
export const conversationAnalyticsLightService = new ConversationAnalyticsLightService();