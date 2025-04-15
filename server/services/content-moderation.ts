/**
 * 内容审查服务
 * 使用OpenAI的Moderation API进行内容审查
 */

import { log } from '../vite';
import fetch from 'node-fetch';

// 审查结果接口
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

// 审查设置接口
export interface ModerationSettings {
  enabled: boolean;
  threshold: number; // 0.0 - 1.0, 数值越低越严格
  blockUserInput: boolean; // 是否阻止违规用户输入
  blockModelOutput: boolean; // 是否阻止违规模型输出
}

/**
 * 内容审查服务
 */
class ContentModerationService {
  private settings: ModerationSettings = {
    enabled: false, // 默认禁用
    threshold: 0.7, // 默认阈值，可根据需要调整
    blockUserInput: true, // 默认阻止违规用户输入
    blockModelOutput: true, // 默认阻止违规模型输出
  };
  private openaiApiKey?: string;

  constructor() {
    // 从环境变量获取OpenAI API密钥
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    log(`内容审查服务初始化，默认状态: ${this.settings.enabled ? '启用' : '禁用'}`);
  }

  /**
   * 更新内容审查设置
   */
  updateSettings(settings: Partial<ModerationSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
    log(`内容审查设置已更新: ${JSON.stringify(this.settings)}`);
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
    // 如果未启用审查，直接返回未标记结果
    if (!this.settings.enabled) {
      return {
        flagged: false,
        categories: {},
        categoryScores: {}
      };
    }

    // 如果未设置API密钥，返回错误
    if (!this.openaiApiKey) {
      log('内容审查失败: 未设置OpenAI API密钥');
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
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          input: text
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        log(`内容审查API错误 (${response.status}): ${errorBody}`);
        return {
          flagged: false,
          categories: {},
          categoryScores: {},
          error: `审查API错误: ${response.status}`
        };
      }

      const data = await response.json();
      const result = data.results[0];

      // 应用自定义阈值
      // 如果任何分类的得分超过阈值，则标记内容
      let flagged = false;
      const categoryScores = { ...result.category_scores };
      const categories: { [key: string]: boolean } = {};

      // 按照阈值重新计算flagged状态
      for (const [category, score] of Object.entries(categoryScores)) {
        const scoreValue = score as number;
        categories[category] = scoreValue > this.settings.threshold;
        if (categories[category]) {
          flagged = true;
        }
      }

      return {
        flagged,
        categories,
        categoryScores
      };
    } catch (error) {
      log(`内容审查请求失败: ${error}`);
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
        error: `审查请求失败: ${error}`
      };
    }
  }

  /**
   * 审查用户输入内容
   * @param text 用户输入文本
   * @returns 如果内容被标记且设置为阻止，返回错误信息；否则返回null
   */
  async moderateUserInput(text: string): Promise<string | null> {
    // 如果未启用或未设置阻止用户输入，直接返回null(允许通过)
    if (!this.settings.enabled || !this.settings.blockUserInput) {
      return null;
    }

    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 找出触发的具体分类
      const triggeredCategories = Object.entries(result.categories)
        .filter(([_, isFlagged]) => isFlagged)
        .map(([category]) => category)
        .join(', ');
      
      return `您的输入包含不适当内容 (${triggeredCategories})，请修改后重试。`;
    }
    
    return null;
  }

  /**
   * 审查模型输出内容
   * @param text 模型生成的文本
   * @returns 如果内容被标记且设置为阻止，返回错误信息；否则返回null
   */
  async moderateModelOutput(text: string): Promise<string | null> {
    // 如果未启用或未设置阻止模型输出，直接返回null(允许通过)
    if (!this.settings.enabled || !this.settings.blockModelOutput) {
      return null;
    }

    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 找出触发的具体分类
      const triggeredCategories = Object.entries(result.categories)
        .filter(([_, isFlagged]) => isFlagged)
        .map(([category]) => category)
        .join(', ');
      
      return `模型生成的回复包含不适当内容 (${triggeredCategories})，已被拦截。请尝试其他提问方式。`;
    }
    
    return null;
  }
}

export const contentModerationService = new ContentModerationService();