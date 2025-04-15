import { log } from "../vite";
import { storage } from "../storage";
import { PromptTemplate } from "@shared/schema";
import { conversationAnalyticsService, type ConversationPhase } from "./conversation-analytics";

/**
 * 提示词管理服务
 * 负责动态组装和注入系统提示词
 */
export class PromptManagerService {
  constructor() {
    log("提示词管理服务初始化完成");
  }
  
  /**
   * 获取指定模型的动态提示词
   * @param modelId 模型ID
   * @param chatId 聊天ID
   * @param userInput 用户输入
   * @param contextMemories 上下文记忆
   * @param searchResults 搜索结果
   * @returns 处理后的完整提示词
   */
  async getDynamicPrompt(
    modelId: string,
    chatId: number,
    userInput: string,
    contextMemories?: string,
    searchResults?: string
  ): Promise<string> {
    try {
      // 获取模型提示词模板
      const template = await storage.getPromptTemplate(modelId);
      
      if (!template) {
        log(`未找到模型 ${modelId} 的提示词模板，使用默认提示词`);
        return this.generateDefaultPrompt(userInput, contextMemories, searchResults);
      }
      
      // 获取当前对话阶段
      const currentPhase = await conversationAnalyticsService.getLatestPhase(chatId);
      log(`当前对话阶段: ${currentPhase}`);
      
      // 使用分阶段模板生成动态提示词
      const dynamicPrompt = await this.buildDynamicPrompt(
        template,
        currentPhase,
        userInput,
        contextMemories,
        searchResults
      );
      
      log(`已为模型 ${modelId} 生成动态提示词`);
      return dynamicPrompt;
    } catch (error) {
      log(`生成动态提示词错误: ${error}`);
      // 出错时返回默认提示词
      return this.generateDefaultPrompt(userInput, contextMemories, searchResults);
    }
  }
  
  /**
   * 构建动态提示词
   * @param template 提示词模板
   * @param phase 当前对话阶段
   * @param userInput 用户输入
   * @param contextMemories 上下文记忆
   * @param searchResults 搜索结果
   * @returns 完整的动态提示词
   */
  private async buildDynamicPrompt(
    template: PromptTemplate,
    phase: ConversationPhase,
    userInput: string,
    contextMemories?: string,
    searchResults?: string
  ): Promise<string> {
    // 如果模板中有完整的promptTemplate，使用完整模板
    if (template.promptTemplate) {
      return this.applyPromptTemplate(
        template.promptTemplate,
        userInput,
        contextMemories,
        searchResults
      );
    }
    
    // 否则使用分区域模板动态组装
    let basePrompt = template.baseTemplate || "你是一个先进的AI学习助手，能够提供个性化学习体验。";
    
    // 添加当前阶段的提示词
    let phasePrompt = "";
    switch (phase) {
      case "K":
        phasePrompt = template.kTemplate || "请了解学习者已知什么，帮助他们表达现有知识。";
        break;
      case "W":
        phasePrompt = template.wTemplate || "请了解学习者想知道什么，鼓励他们提出问题。";
        break;
      case "L":
        phasePrompt = template.lTemplate || "帮助学习者消化新知识，引导他们理解和应用刚学到的概念。";
        break;
      case "Q":
        phasePrompt = template.qTemplate || "鼓励学习者基于新知识提出更深层次问题，帮助他们反思学习过程。";
        break;
      default:
        phasePrompt = "帮助学习者探索新知识，提供个性化的学习体验。";
    }
    
    // 添加风格指导
    const stylePrompt = template.styleTemplate || "你的回应应该清晰、结构化，易于理解，同时保持专业性和启发性。";
    
    // 添加政策限制
    const policyPrompt = template.policyTemplate || "确保回答教育、安全、无偏见，避免提供有害内容。";
    
    // 组装完整提示词
    let fullPrompt = `${basePrompt}\n\n${phasePrompt}\n\n${stylePrompt}\n\n${policyPrompt}`;
    
    // 添加敏感词过滤
    if (template.sensitiveWords) {
      fullPrompt += `\n\n请避免讨论以下敏感主题：${template.sensitiveWords}`;
    }
    
    // 添加上下文记忆
    if (contextMemories) {
      fullPrompt += `\n\n以下是用户的历史学习记忆和对话上下文：\n${contextMemories}\n\n请在回答时自然地融入这些上下文信息，使回答更加连贯和个性化。`;
    }
    
    // 添加搜索结果
    if (searchResults) {
      fullPrompt += `\n\n以下是与问题相关的网络搜索结果：\n${searchResults}\n\n请利用这些搜索结果提供准确、最新的信息。`;
    }
    
    // 添加用户问题
    fullPrompt += `\n\n用户当前问题: ${userInput}`;
    
    return fullPrompt;
  }
  
  /**
   * 应用现有的提示词模板
   * @param promptTemplate 提示词模板
   * @param userInput 用户输入
   * @param contextMemories 上下文记忆
   * @param searchResults 搜索结果
   * @returns 处理后的提示词
   */
  private applyPromptTemplate(
    promptTemplate: string,
    userInput: string,
    contextMemories?: string,
    searchResults?: string
  ): string {
    // 替换模板变量
    let processedPrompt = promptTemplate
      .replace(/{{user_input}}/g, userInput)
      .replace(/{{date}}/g, new Date().toLocaleString())
      .replace(/{{memory}}/g, contextMemories || "")
      .replace(/{{search}}/g, searchResults || "");
    
    // 处理条件部分
    processedPrompt = processedPrompt.replace(
      /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
      contextMemories ? "$1" : ""
    );
    
    processedPrompt = processedPrompt.replace(
      /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
      searchResults ? "$1" : ""
    );
    
    return processedPrompt;
  }
  
  /**
   * 生成默认提示词
   * @param userInput 用户输入
   * @param contextMemories 上下文记忆
   * @param searchResults 搜索结果
   * @returns 默认提示词
   */
  private generateDefaultPrompt(
    userInput: string,
    contextMemories?: string,
    searchResults?: string
  ): string {
    let defaultPrompt = `你是一个先进的AI学习助手，基于 KWLQ 教学模型提供启发式教学体验。你的目标是引导学习者通过提问来探索知识，而不是直接提供答案。`;
    
    // 添加上下文记忆
    if (contextMemories) {
      defaultPrompt += `\n\n以下是用户的历史学习记忆和对话上下文：\n${contextMemories}\n\n请在回答时自然地融入这些上下文信息，使回答更加连贯和个性化。`;
    }
    
    // 添加搜索结果
    if (searchResults) {
      defaultPrompt += `\n\n以下是与问题相关的网络搜索结果：\n${searchResults}\n\n请利用这些搜索结果提供准确、最新的信息。`;
    }
    
    // 添加用户问题
    defaultPrompt += `\n\n用户当前问题: ${userInput}\n\n请提供详细、有帮助的回答，采用苏格拉底式提问法引导用户思考。`;
    
    return defaultPrompt;
  }
}

// 导出单例
export const promptManagerService = new PromptManagerService();