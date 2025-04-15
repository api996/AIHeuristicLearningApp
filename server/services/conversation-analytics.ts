import fetch from "node-fetch";
import { log } from "../vite";
import { storage } from "../storage";
import { Message } from "@shared/schema";

// 对话阶段类型
export type ConversationPhase = "K" | "W" | "L" | "Q";

// 对话阶段分析结果
export interface PhaseAnalysisResult {
  currentPhase: ConversationPhase;
  summary: string;
  confidence: number;
}

/**
 * 对话阶段分析服务
 * 使用Gemini模型对对话内容进行摘要和阶段识别
 */
export class ConversationAnalyticsService {
  private apiKey: string;
  private endpoint: string;
  
  constructor() {
    // 使用Gemini API进行对话分析
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-02-26:generateContent";
    
    if (!this.apiKey) {
      log("警告: 未配置Gemini API密钥，对话阶段分析将无法使用");
    } else {
      log("对话阶段分析服务初始化完成");
    }
  }
  
  /**
   * 分析对话阶段
   * @param chatId 聊天ID
   * @param messages 最近的消息列表
   * @returns 对话阶段分析结果
   */
  async analyzeConversationPhase(chatId: number, messages: Message[]): Promise<PhaseAnalysisResult | null> {
    try {
      if (!this.apiKey) {
        log("未配置Gemini API密钥，无法进行对话阶段分析");
        return null;
      }
      
      if (!messages || messages.length === 0) {
        log("无对话消息，无法进行对话阶段分析");
        return null;
      }
      
      // 格式化对话内容
      const conversationText = this.formatConversation(messages);
      
      // 调用Gemini进行对话分析
      const result = await this.callGeminiForAnalysis(conversationText);
      
      if (result) {
        // 保存分析结果到数据库
        await storage.saveConversationAnalytic(
          chatId,
          result.currentPhase,
          result.summary
        );
        
        log(`对话 ${chatId} 的阶段分析结果: ${result.currentPhase}, 置信度: ${result.confidence}`);
        return result;
      }
      
      return null;
    } catch (error) {
      log(`对话阶段分析错误: ${error}`);
      return null;
    }
  }
  
  /**
   * 格式化对话内容
   * @param messages 消息列表
   * @returns 格式化后的对话文本
   */
  private formatConversation(messages: Message[]): string {
    // 选取最近的10条消息
    const recentMessages = messages.slice(-10);
    
    // 格式化对话内容
    return recentMessages.map(msg => {
      const role = msg.role === 'user' ? '用户' : 'AI';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }
  
  /**
   * 调用Gemini进行对话分析
   * @param conversationText 对话文本
   * @returns 对话阶段分析结果
   */
  private async callGeminiForAnalysis(conversationText: string): Promise<PhaseAnalysisResult | null> {
    try {
      const prompt = `
你是一个专业的教育对话分析器，基于KWLQ教学模型分析对话阶段。以下是KWLQ模型的四个阶段说明：

- K阶段 (Know): 了解学习者已知什么。这个阶段学习者表达他们已经了解的知识，或提出基础问题。
- W阶段 (Want to know): 了解学习者想知道什么。这个阶段学习者表达他们想要了解的问题，表现出探索欲望。
- L阶段 (Learned): 学习者学到了什么。这个阶段学习者正在获取和消化新知识，或者表达刚学到的概念。
- Q阶段 (Questions still have): 学习者还有哪些问题。这个阶段学习者基于新知识提出更深层次问题，或反思学习过程。

请分析以下对话，判断当前处于哪个阶段(K/W/L/Q)，并提供一段简短的总结：

${conversationText}

请使用以下JSON格式回答：
{
  "currentPhase": "K或W或L或Q",
  "summary": "对话内容摘要，100字以内",
  "confidence": 0.1到1.0之间的数字，表示判断的置信度
}
`;

      // 构建请求体
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
          maxOutputTokens: 1024,
          responseMimeType: "application/json"
        }
      };
      
      // 调用API
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Gemini API错误: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (content) {
        try {
          // 尝试解析返回的JSON
          const result = JSON.parse(content);
          
          // 验证返回结果
          if (
            result.currentPhase && 
            result.summary && 
            typeof result.confidence === 'number' &&
            ['K', 'W', 'L', 'Q'].includes(result.currentPhase)
          ) {
            return {
              currentPhase: result.currentPhase as ConversationPhase,
              summary: result.summary,
              confidence: result.confidence
            };
          } else {
            log(`无效的对话分析结果格式: ${content}`);
          }
        } catch (e) {
          log(`对话分析结果解析错误: ${e}, 原始内容: ${content}`);
        }
      }
      
      return null;
    } catch (error) {
      log(`调用Gemini进行对话分析错误: ${error}`);
      return null;
    }
  }
  
  /**
   * 获取最新的对话阶段
   * @param chatId 聊天ID
   * @returns 最新的对话阶段或默认阶段
   */
  async getLatestPhase(chatId: number): Promise<ConversationPhase> {
    try {
      const latest = await storage.getLatestConversationAnalytic(chatId);
      
      if (latest) {
        return latest.currentPhase as ConversationPhase;
      }
      
      // 默认为K阶段
      return "K";
    } catch (error) {
      log(`获取最新对话阶段错误: ${error}`);
      return "K"; // 出错时返回默认阶段
    }
  }
}

// 导出单例
export const conversationAnalyticsService = new ConversationAnalyticsService();