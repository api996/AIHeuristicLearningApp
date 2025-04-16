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
 * 对话阶段分析服务
 * 使用Gemini模型对对话内容进行摘要和阶段识别
 * 
 * 对话阶段:
 * K - 知识获取阶段 (Knowledge Acquisition): 用户主要是获取信息和知识
 * W - 疑惑表达阶段 (Wondering): 用户表达疑惑、困惑或不确定性
 * L - 学习深化阶段 (Learning Deepening): 用户在理解和应用知识，寻求更深层次的解释
 * Q - 质疑挑战阶段 (Questioning): 用户在批判性思考，验证信息或提供反馈
 */
export class ConversationAnalyticsService {
  private apiKey: string;
  private endpoint: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent";
    log("对话阶段分析服务初始化完成");
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
      
      // 调用Gemini进行分析
      const analysisResult = await this.callGeminiForAnalysis(conversationText);
      
      // 如果分析成功，保存结果到数据库
      if (analysisResult) {
        await storage.saveConversationAnalytic(
          chatId,
          analysisResult.currentPhase,
          analysisResult.summary
        );
        
        log(`对话阶段分析结果: 阶段=${analysisResult.currentPhase}, 摘要="${analysisResult.summary.substring(0, 50)}..."`);
        return analysisResult;
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
    return messages.map((msg, index) => {
      const role = msg.role === "user" ? "用户" : "AI助手";
      return `[${index + 1}] ${role}: ${msg.content}`;
    }).join("\n\n");
  }

  /**
   * 调用Gemini进行对话分析
   * @param conversationText 对话文本
   * @returns 对话阶段分析结果
   */
  private async callGeminiForAnalysis(conversationText: string): Promise<PhaseAnalysisResult | null> {
    // 如果没有API密钥，返回默认值
    if (!this.apiKey) {
      log("没有Gemini API密钥，使用默认对话阶段分析");
      return {
        currentPhase: "K",
        summary: "用户正在寻求信息，处于知识获取阶段",
        confidence: 0.7
      };
    }

    try {
      const prompt = `
分析以下对话，确定当前对话所处的阶段并提供简短摘要。

对话阶段分类:
- K (知识获取): 用户主要在寻求基本信息和知识。用户可能提出直接问题，表现出对新知识的渴望。
- W (疑惑表达): 用户表达困惑、不确定性或对概念的难以理解。用户可能提出"为什么"、"如何"类型的问题，或表达对某个概念的困惑。
- L (学习深化): 用户正在更深入地理解概念，尝试应用知识，或探索知识间的联系。用户可能请求详细解释、示例，或尝试将新知识与先前的理解联系起来。
- Q (质疑挑战): 用户在批判性思考，质疑信息，或挑战给出的解释。用户可能提供替代观点，或指出他们认为的不一致之处。

对话内容:
${conversationText}

要求:
1. 仅基于这段对话确定当前阶段。
2. 用一个字母表示阶段: K, W, L, 或 Q
3. 提供对当前交互的简短摘要(50字以内)
4. 评估你的阶段判断的置信度(0.0-1.0)

返回JSON格式如下:
{
  "currentPhase": "字母",
  "summary": "简短摘要",
  "confidence": 数值
}
`;

      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`Gemini API对话分析错误: ${response.status} - ${errorText}`);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error("API返回的响应为空");
      }

      // 尝试从响应文本中提取JSON对象
      try {
        // 匹配JSON部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonResult = JSON.parse(jsonMatch[0]);
          
          // 验证格式
          if (
            typeof jsonResult.currentPhase === 'string' && 
            ['K', 'W', 'L', 'Q'].includes(jsonResult.currentPhase) &&
            typeof jsonResult.summary === 'string' &&
            typeof jsonResult.confidence === 'number'
          ) {
            return {
              currentPhase: jsonResult.currentPhase as ConversationPhase,
              summary: jsonResult.summary,
              confidence: jsonResult.confidence
            };
          }
        }
        
        // 如果解析失败，尝试从文本中提取阶段信息
        const phaseMatch = responseText.match(/currentPhase"?\s*:\s*"([KWLQ])"/i);
        const summaryMatch = responseText.match(/summary"?\s*:\s*"([^"]*)"/i);
        const confidenceMatch = responseText.match(/confidence"?\s*:\s*([\d.]+)/i);
        
        if (phaseMatch && summaryMatch) {
          return {
            currentPhase: phaseMatch[1] as ConversationPhase,
            summary: summaryMatch[1],
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7
          };
        }
        
        // 默认返回知识获取阶段
        log(`无法从响应中解析JSON，使用默认值。响应: ${responseText.substring(0, 200)}...`);
        return {
          currentPhase: "K",
          summary: "无法确定具体对话阶段，默认为知识获取阶段",
          confidence: 0.5
        };
      } catch (error) {
        log(`解析Gemini响应错误: ${error}, 原始响应: ${responseText.substring(0, 200)}...`);
        throw error;
      }
    } catch (error) {
      log(`调用Gemini进行对话分析错误: ${error}`);
      
      // 出错时使用默认值
      return {
        currentPhase: "K",
        summary: "分析出错，默认为知识获取阶段",
        confidence: 0.5
      };
    }
  }

  /**
   * 获取最新的对话阶段
   * @param chatId 聊天ID
   * @returns 最新的对话阶段或默认阶段
   */
  async getLatestPhase(chatId: number): Promise<ConversationPhase> {
    try {
      const latestAnalytic = await storage.getLatestConversationAnalytic(chatId);
      return latestAnalytic?.currentPhase || "K"; // 默认为知识获取阶段
    } catch (error) {
      log(`获取最新对话阶段错误: ${error}`);
      return "K"; // 出错时默认为知识获取阶段
    }
  }
}

export const conversationAnalyticsService = new ConversationAnalyticsService();