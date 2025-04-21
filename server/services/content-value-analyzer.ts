/**
 * 内容价值分析服务
 * 使用轻量级模型快速判断内容的教育价值
 * 避免无价值内容进入向量数据库，提高记忆质量
 */

import { log } from "../vite";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// 内容价值评估结果接口
export interface ContentValueAssessment {
  // 是否有价值
  isValuable: boolean;
  // 价值分数 (0-1)
  score: number;
  // 评估原因
  reason: string;
}

/**
 * 内容价值分析服务
 * 使用Gemini轻量级模型分析内容的教育价值和信息密度
 */
export class ContentValueAnalyzer {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private initialized: boolean = false;
  private valueThreshold: number = 0.4; // 默认价值阈值

  constructor() {
    // 尝试从环境变量获取API密钥
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (this.apiKey) {
      this.initialize();
    } else {
      log('[ContentValueAnalyzer] 未找到Gemini API密钥，内容价值分析服务无法初始化', 'warn');
    }
  }

  /**
   * 初始化Gemini API客户端
   */
  private initialize(): void {
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.initialized = true;
      log('[ContentValueAnalyzer] 初始化成功', 'info');
    } catch (error) {
      log(`[ContentValueAnalyzer] 初始化失败: ${error}`, 'error');
      this.genAI = null;
      this.initialized = false;
    }
  }

  /**
   * 设置内容价值阈值
   * @param threshold 阈值 (0-1)
   */
  setValueThreshold(threshold: number): void {
    this.valueThreshold = Math.max(0, Math.min(1, threshold));
    log(`[ContentValueAnalyzer] 内容价值阈值已设置为 ${this.valueThreshold}`, 'info');
  }

  /**
   * 获取当前内容价值阈值
   * @returns 当前阈值
   */
  getValueThreshold(): number {
    return this.valueThreshold;
  }

  /**
   * 评估内容价值
   * 使用轻量级Gemini模型快速分析内容价值
   * @param content 待评估内容
   * @returns 内容价值评估结果
   */
  async assessContentValue(content: string): Promise<ContentValueAssessment> {
    try {
      // 如果Gemini API不可用，默认认为有价值
      if (!this.genAI || !this.initialized) {
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

      // 发送请求到模型 - 使用简单风格调用
      const result = await model.generateContent(prompt);
      
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
      log(`[ContentValueAnalyzer] 内容价值评估错误: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return {
        isValuable: true, 
        score: 0.6,
        reason: "评估出错，默认有价值"
      };
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
    if (assessment.score < this.valueThreshold) {
      log(`[ContentValueAnalyzer] 内容不值得向量化: ${assessment.reason}, 分数=${assessment.score}`, 'info');
      return false;
    }
    
    return true;
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
      
      log(`[ContentValueAnalyzer] 无法解析JSON响应: ${text.substring(0, 100)}...`, 'warn');
      return null;
    }
  }
}

// 导出服务实例
export const contentValueAnalyzer = new ContentValueAnalyzer();