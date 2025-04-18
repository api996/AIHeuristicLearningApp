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
    
    // 注意：对于主对话分析保留使用Gemini-2.5-Pro-Exp-03-25
    // 对于后台处理任务和工具性分析，使用轻量级的conversationAnalyticsLightService
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

      // 尝试从响应文本中提取JSON对象，使用增强的错误处理机制
      try {
        // 先记录原始响应，便于调试
        log(`Gemini原始响应(前200字符): ${responseText.substring(0, 200)}...`);
        
        // 方法1: 尝试直接解析整个响应
        try {
          const directResult = JSON.parse(responseText);
          
          // 验证直接解析结果
          if (
            typeof directResult.currentPhase === 'string' && 
            ['K', 'W', 'L', 'Q'].includes(directResult.currentPhase) &&
            typeof directResult.summary === 'string'
          ) {
            log(`成功通过直接JSON解析`);
            return {
              currentPhase: directResult.currentPhase as ConversationPhase,
              summary: directResult.summary,
              confidence: typeof directResult.confidence === 'number' ? directResult.confidence : 0.7
            };
          }
        } catch (error) {
          // 直接解析失败，继续尝试其他方法
          const directError = error instanceof Error ? error : new Error(String(error));
          log(`直接JSON解析失败: ${directError.message}`);
        }
        
        // 方法2: 尝试匹配并提取JSON对象
        const jsonMatch = responseText.match(/\{[\s\S]*?\}/g);
        if (jsonMatch) {
          // 尝试解析找到的每个JSON对象，直到找到有效的
          for (const jsonStr of jsonMatch) {
            try {
              const jsonResult = JSON.parse(jsonStr);
              
              // 验证格式 - 宽松验证，只要有阶段即可
              if (
                typeof jsonResult.currentPhase === 'string' && 
                ['K', 'W', 'L', 'Q'].includes(jsonResult.currentPhase)
              ) {
                log(`成功通过JSON提取解析`);
                return {
                  currentPhase: jsonResult.currentPhase as ConversationPhase,
                  summary: typeof jsonResult.summary === 'string' ? jsonResult.summary : "未提供摘要",
                  confidence: typeof jsonResult.confidence === 'number' ? jsonResult.confidence : 0.7
                };
              }
            } catch (error) {
              // 继续尝试下一个匹配项
              const jsonError = error instanceof Error ? error : new Error(String(error));
              log(`JSON对象解析失败: ${jsonError.message}`);
            }
          }
        }
        
        // 方法3: 使用正则表达式提取关键字段
        log(`尝试使用正则表达式提取关键信息`);
        // 尝试多种格式的字段名匹配
        const phaseMatches = [
          responseText.match(/currentPhase"?\s*[:=]\s*"?([KWLQ])"?/i),
          responseText.match(/current_phase"?\s*[:=]\s*"?([KWLQ])"?/i),
          responseText.match(/phase"?\s*[:=]\s*"?([KWLQ])"?/i),
          responseText.match(/阶段"?\s*[:=]\s*"?([KWLQ])"?/i),
          // 尝试匹配完整单词
          responseText.match(/\b(Knowledge|Wondering|Learning|Questioning)\b/i)
        ];
        
        const summaryMatches = [
          responseText.match(/summary"?\s*[:=]\s*"([^"]*?)"/i),
          responseText.match(/摘要"?\s*[:=]\s*"([^"]*?)"/i),
          responseText.match(/summary"?\s*[:=]\s*'([^']*?)'/i)
        ];
        
        const confidenceMatches = [
          responseText.match(/confidence"?\s*[:=]\s*([\d.]+)/i),
          responseText.match(/置信度"?\s*[:=]\s*([\d.]+)/i)
        ];
        
        // 找到第一个有效的匹配
        const phaseMatch = phaseMatches.find(m => m !== null);
        const summaryMatch = summaryMatches.find(m => m !== null);
        const confidenceMatch = confidenceMatches.find(m => m !== null);
        
        // 如果找到了阶段信息
        if (phaseMatch) {
          let phase: ConversationPhase = "K"; // 默认值
          
          // 根据匹配的内容确定阶段
          const matchedPhase = phaseMatch[1];
          if (matchedPhase.length === 1 && ['K', 'W', 'L', 'Q'].includes(matchedPhase.toUpperCase())) {
            phase = matchedPhase.toUpperCase() as ConversationPhase;
          } else if (matchedPhase.startsWith('K') || matchedPhase.startsWith('k')) {
            phase = "K";
          } else if (matchedPhase.startsWith('W') || matchedPhase.startsWith('w')) {
            phase = "W";
          } else if (matchedPhase.startsWith('L') || matchedPhase.startsWith('l')) {
            phase = "L";
          } else if (matchedPhase.startsWith('Q') || matchedPhase.startsWith('q')) {
            phase = "Q";
          }
          
          log(`成功通过正则表达式提取: 阶段=${phase}`);
          return {
            currentPhase: phase,
            summary: summaryMatch ? summaryMatch[1] : "使用正则表达式提取的对话阶段分析",
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.7
          };
        }
        
        // 方法4: 分析整个文本内容，查找关键词来推断阶段
        log(`尝试通过关键词分析推断阶段`);
        const lowerText = responseText.toLowerCase();
        
        // 关键词匹配表 - 按优先级排序
        const keywordMap: Record<ConversationPhase, string[]> = {
          "K": ["知识获取", "knowledge acquisition", "seeking information", "asking for information", "获取信息", "寻求知识"],
          "W": ["疑惑", "困惑", "不确定", "wonder", "confusion", "unclear", "uncertainty", "为什么", "如何", "why"],
          "L": ["深化", "理解", "应用", "联系", "deepen", "understanding", "learning", "application", "connect", "理解深入"],
          "Q": ["质疑", "挑战", "批判", "challenge", "critical", "questioning", "doubt", "质疑信息", "提供替代"]
        };
        
        // 计算每个阶段的关键词出现次数
        const phaseCounts: Record<ConversationPhase, number> = { "K": 0, "W": 0, "L": 0, "Q": 0 };
        
        for (const [phase, keywords] of Object.entries(keywordMap)) {
          for (const keyword of keywords) {
            // 统计关键词出现的次数
            const regex = new RegExp(keyword, 'gi');
            const matches = lowerText.match(regex);
            if (matches) {
              phaseCounts[phase as ConversationPhase] += matches.length;
            }
          }
        }
        
        // 找出关键词匹配最多的阶段
        let maxCount = 0;
        let inferredPhase: ConversationPhase = "K"; // 默认为K
        
        for (const [phase, count] of Object.entries(phaseCounts)) {
          if (count > maxCount) {
            maxCount = count;
            inferredPhase = phase as ConversationPhase;
          }
        }
        
        if (maxCount > 0) {
          log(`通过关键词分析推断阶段: ${inferredPhase}, 匹配次数: ${maxCount}`);
          return {
            currentPhase: inferredPhase,
            summary: `通过文本分析推断的对话阶段`,
            confidence: 0.6 // 较低的置信度
          };
        }
        
        // 所有方法都失败，返回默认值
        log(`所有解析方法失败，使用默认值`);
        return {
          currentPhase: "K", // 默认阶段
          summary: "无法从API响应中确定具体对话阶段，默认为知识获取阶段",
          confidence: 0.5
        };
      } catch (error) {
        log(`解析Gemini响应过程中发生严重错误: ${error}`);
        if (error instanceof Error && error.stack) {
          log(`错误堆栈: ${error.stack}`);
        }
        log(`原始响应: ${responseText ? responseText.substring(0, 200) + '...' : 'undefined'}`);
        
        // 发生任何错误都返回默认值，不抛出异常
        return {
          currentPhase: "K",
          summary: "解析过程出错，默认为知识获取阶段",
          confidence: 0.5
        };
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