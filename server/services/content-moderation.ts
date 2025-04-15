/**
 * 内容审查服务
 * 使用OpenAI的Moderation API进行内容审查
 */

import { log } from '../vite';
import fetch from 'node-fetch';

// 从环境变量获取OpenAI API密钥
const openaiApiKey = process.env.OPENAI_API_KEY;

export interface ModerationResult {
  flagged: boolean;
  categories: {
    [key: string]: boolean;
  };
  categoryScores: {
    [key: string]: number;
  };
  error?: string;
}

export interface ModerationSettings {
  enabled: boolean;
  threshold: number; // 0.0 - 1.0, 数值越低越严格
  blockUserInput: boolean; // 是否阻止违规用户输入
  blockModelOutput: boolean; // 是否阻止违规模型输出
}

class ContentModerationService {
  private settings: ModerationSettings = {
    enabled: false,
    threshold: 0.7, // 默认阈值
    blockUserInput: true,
    blockModelOutput: true
  };

  constructor() {
    log(`内容审查服务初始化，默认状态: ${this.settings.enabled ? '启用' : '禁用'}`);
  }

  /**
   * 更新内容审查设置
   */
  updateSettings(settings: Partial<ModerationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    log(`内容审查设置已更新: 状态=${this.settings.enabled ? '启用' : '禁用'}, 阈值=${this.settings.threshold}`);
  }

  /**
   * 获取当前内容审查设置
   */
  getSettings(): ModerationSettings {
    return { ...this.settings };
  }

  /**
   * 使用OpenAI Moderation API审查内容
   * @param text 要审查的文本
   * @returns 审查结果
   */
  async moderateContent(text: string): Promise<ModerationResult> {
    // 如果审查功能关闭，直接返回未标记
    if (!this.settings.enabled) {
      return {
        flagged: false,
        categories: {},
        categoryScores: {}
      };
    }

    // 如果没有OpenAI API密钥，记录警告并返回未标记
    if (!openaiApiKey) {
      log(`警告: 未配置OpenAI API密钥，内容审查功能无法使用`);
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        error: 'OpenAI API密钥未配置'
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-moderation-latest' // 使用最新的审查模型
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        log(`OpenAI Moderation API错误: ${response.status} - ${errorData}`);
        throw new Error(`Moderation API错误: ${response.status}`);
      }

      const data = await response.json() as any;
      const result = data.results[0];

      // 应用自定义阈值逻辑 - 如果任何类别的得分超过阈值，则标记
      let flagged = false;
      const categoryScores = result.category_scores || {};
      
      // 检查是否有任何类别分数超过阈值
      for (const key in categoryScores) {
        const score = categoryScores[key];
        if (typeof score === 'number' && score > this.settings.threshold) {
          flagged = true;
          break;
        }
      }

      return {
        flagged: flagged,
        categories: result.categories || {},
        categoryScores: categoryScores
      };
    } catch (error) {
      log(`内容审查出错: ${error instanceof Error ? error.message : String(error)}`);
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        error: `审查出错: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 审查用户输入内容
   * @param text 用户输入文本
   * @returns 如果内容被标记且设置为阻止，返回错误信息；否则返回null
   */
  async moderateUserInput(text: string): Promise<string | null> {
    if (!this.settings.enabled || !this.settings.blockUserInput) {
      return null; // 未启用审查或未启用阻止用户输入，不进行处理
    }

    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 记录违规情况
      log(`用户输入被标记为不适当内容: ${JSON.stringify(result.categoryScores)}`);
      return "⚠️ 您的输入包含不适当内容，请修改后再试。";
    }
    
    return null; // 未被标记
  }

  /**
   * 审查模型输出内容
   * @param text 模型生成的文本
   * @returns 如果内容被标记且设置为阻止，返回错误信息；否则返回null
   */
  async moderateModelOutput(text: string): Promise<string | null> {
    if (!this.settings.enabled || !this.settings.blockModelOutput) {
      return null; // 未启用审查或未启用阻止模型输出，不进行处理
    }

    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 记录违规情况
      log(`模型输出被标记为不适当内容: ${JSON.stringify(result.categoryScores)}`);
      return "⚠️ 模型生成的内容不符合政策，已被屏蔽。请尝试调整您的提问方式。";
    }
    
    return null; // 未被标记
  }
}

// 导出单例实例
export const contentModerationService = new ContentModerationService();