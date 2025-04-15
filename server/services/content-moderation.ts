/**
 * 内容审查服务
 * 使用OpenAI的Moderation API对用户输入和模型输出进行内容审查
 */

import fs from 'fs';
import path from 'path';
import { log } from '../vite';

// 审查类别分数接口
export interface CategoryScores {
  sexual: number;
  hate: number;
  harassment: number;
  'self-harm': number;
  'sexual/minors': number;
  'hate/threatening': number;
  'violence/graphic': number;
  'self-harm/intent': number;
  'self-harm/instructions': number;
  'harassment/threatening': number;
  violence: number;
}

// 审查标记分类接口
export interface FlaggedCategories {
  sexual: boolean;
  hate: boolean;
  harassment: boolean;
  'self-harm': boolean;
  'sexual/minors': boolean;
  'hate/threatening': boolean;
  'violence/graphic': boolean;
  'self-harm/intent': boolean;
  'self-harm/instructions': boolean;
  'harassment/threatening': boolean;
  violence: boolean;
}

// 审查结果接口
export interface ModerationResult {
  flagged: boolean;
  categories: FlaggedCategories;
  categoryScores: CategoryScores;
  error?: string;
}

// 内容审查设置接口
export interface ModerationSettings {
  enabled: boolean;
  threshold: number; // 0.0 - 1.0，数值越小越严格
  blockUserInput: boolean; // 是否阻止违规用户输入
  blockModelOutput: boolean; // 是否阻止违规模型输出
}

// 默认设置
const DEFAULT_SETTINGS: ModerationSettings = {
  enabled: false, // 默认禁用
  threshold: 0.7, // 默认阈值
  blockUserInput: true,
  blockModelOutput: true,
};

// 内容审查数据文件路径
const SETTINGS_FILE = path.join(process.cwd(), 'server/data/moderation-settings.json');

/**
 * 内容审查服务类
 */
class ContentModerationService {
  private settings: ModerationSettings;
  
  constructor() {
    this.settings = this.loadSettings();
    log(`内容审查服务初始化，默认状态: ${this.settings.enabled ? '启用' : '禁用'}`);
  }
  
  /**
   * 加载设置
   */
  private loadSettings(): ModerationSettings {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const settings = JSON.parse(fileContent);
        return { ...DEFAULT_SETTINGS, ...settings };
      }
    } catch (err) {
      log(`加载内容审查设置失败: ${err}`);
    }
    
    return DEFAULT_SETTINGS;
  }
  
  /**
   * 保存设置
   */
  private saveSettings(): void {
    try {
      const dirPath = path.dirname(SETTINGS_FILE);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch (err) {
      log(`保存内容审查设置失败: ${err}`);
    }
  }
  
  /**
   * 获取当前设置
   */
  getSettings(): ModerationSettings {
    return { ...this.settings };
  }
  
  /**
   * 更新设置
   */
  updateSettings(newSettings: Partial<ModerationSettings>): ModerationSettings {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
    
    this.saveSettings();
    return this.getSettings();
  }
  
  /**
   * 审查内容
   * @param text 要审查的文本
   * @returns 审查结果
   */
  async moderateContent(text: string): Promise<ModerationResult> {
    // 如果未启用内容审查，直接返回通过结果
    if (!this.settings.enabled) {
      return {
        flagged: false,
        categories: this.createEmptyCategories(),
        categoryScores: this.createEmptyScores(),
      };
    }
    
    try {
      // 使用node-fetch来支持Node.js环境
      const { default: nodeFetch } = await import('node-fetch');
      
      const response = await nodeFetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ input: text }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`内容审查API错误: ${response.status} ${errorText}`);
        return {
          flagged: false, // 审查失败时默认通过，避免阻止正常交流
          categories: this.createEmptyCategories(),
          categoryScores: this.createEmptyScores(),
          error: `API错误: ${response.status}`,
        };
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        throw new Error('未收到有效的审查结果');
      }
      
      const result = data.results[0];
      
      // 根据阈值调整结果
      const adjustedCategories = this.adjustCategoriesByThreshold(
        result.categories,
        result.category_scores,
        this.settings.threshold
      );
      
      return {
        flagged: Object.values(adjustedCategories).some(value => value),
        categories: adjustedCategories,
        categoryScores: this.normalizeScores(result.category_scores),
      };
    } catch (err) {
      log(`内容审查失败: ${err}`);
      return {
        flagged: false, // 审查失败时默认通过
        categories: this.createEmptyCategories(),
        categoryScores: this.createEmptyScores(),
        error: `审查处理错误: ${err}`,
      };
    }
  }
  
  /**
   * 根据设置的阈值调整分类结果
   */
  private adjustCategoriesByThreshold(
    categories: Record<string, boolean>,
    scores: Record<string, number>,
    threshold: number
  ): FlaggedCategories {
    const result: any = {};
    
    for (const key in scores) {
      result[key] = scores[key] > threshold;
    }
    
    return result as FlaggedCategories;
  }
  
  /**
   * 创建空的分类结果(全部为false)
   */
  private createEmptyCategories(): FlaggedCategories {
    return {
      sexual: false,
      hate: false,
      harassment: false,
      'self-harm': false,
      'sexual/minors': false,
      'hate/threatening': false,
      'violence/graphic': false,
      'self-harm/intent': false,
      'self-harm/instructions': false,
      'harassment/threatening': false,
      violence: false,
    };
  }
  
  /**
   * 创建空的分数结果(全部为0)
   */
  private createEmptyScores(): CategoryScores {
    return {
      sexual: 0,
      hate: 0,
      harassment: 0,
      'self-harm': 0,
      'sexual/minors': 0,
      'hate/threatening': 0,
      'violence/graphic': 0,
      'self-harm/intent': 0,
      'self-harm/instructions': 0,
      'harassment/threatening': 0,
      violence: 0,
    };
  }
  
  /**
   * 规范化分数格式(API返回的键名可能是snake_case)
   */
  private normalizeScores(scores: Record<string, number>): CategoryScores {
    const result: any = {};
    
    // 转换snake_case到camelCase或保持原样
    for (const key in scores) {
      const normalizedKey = key.replace(/_/g, '-');
      result[normalizedKey] = scores[key];
    }
    
    return result as CategoryScores;
  }
  
  /**
   * 检查用户输入是否应该被阻止
   * @param text 用户输入的文本
   * @returns 返回undefined表示通过，否则返回阻止原因
   */
  async shouldBlockUserInput(text: string): Promise<string | undefined> {
    // 如果未启用内容审查或未配置阻止用户输入，直接通过
    if (!this.settings.enabled || !this.settings.blockUserInput) {
      return undefined;
    }
    
    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 获取触发的分类
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, isFlagged]) => isFlagged)
        .map(([category]) => category)
        .join(', ');
      
      return `您的输入包含不适当内容(${flaggedCategories})，请修改后重试`;
    }
    
    return undefined;
  }
  
  /**
   * 检查模型输出是否应该被阻止
   * @param text 模型输出的文本
   * @returns 返回undefined表示通过，否则返回阻止原因
   */
  async shouldBlockModelOutput(text: string): Promise<string | undefined> {
    // 如果未启用内容审查或未配置阻止模型输出，直接通过
    if (!this.settings.enabled || !this.settings.blockModelOutput) {
      return undefined;
    }
    
    const result = await this.moderateContent(text);
    
    if (result.flagged) {
      // 获取触发的分类
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, isFlagged]) => isFlagged)
        .map(([category]) => category)
        .join(', ');
      
      return `模型生成的内容包含不适当内容(${flaggedCategories})，已被系统拦截`;
    }
    
    return undefined;
  }
}

// 导出内容审查服务实例
export const contentModerationService = new ContentModerationService();