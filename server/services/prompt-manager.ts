import { log } from "../vite";
import { storage } from "../storage";
import { type PromptTemplate } from "../../shared/schema";
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
      // 获取提示词模板
      const promptTemplate = await storage.getPromptTemplate(modelId);
      
      // 如果没有找到模板，使用默认提示词
      if (!promptTemplate) {
        log(`未找到模型 ${modelId} 的提示词模板，使用默认提示词`);
        return this.generateDefaultPrompt(userInput, contextMemories, searchResults);
      }
      
      // 获取当前对话阶段
      const currentPhase = await conversationAnalyticsService.getLatestPhase(chatId);
      log(`当前对话阶段: ${currentPhase}`);
      
      // 根据当前阶段构建动态提示词
      const dynamicPrompt = await this.buildDynamicPrompt(
        promptTemplate,
        currentPhase,
        userInput,
        contextMemories,
        searchResults
      );
      
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
    // 根据当前阶段选择适当的模板
    let baseTemplate = template.template || ""; // 基础模板
    
    // 添加阶段特定模板
    let phaseTemplate = "";
    switch (phase) {
      case "K":
        phaseTemplate = template.kTemplate || "";
        break;
      case "W":
        phaseTemplate = template.wTemplate || "";
        break;
      case "L":
        phaseTemplate = template.lTemplate || "";
        break;
      case "Q":
        phaseTemplate = template.qTemplate || "";
        break;
    }
    
    // 合并模板
    let fullTemplate = baseTemplate;
    
    if (phaseTemplate) {
      fullTemplate += "\n\n" + phaseTemplate;
    }
    
    // 添加样式模板（如果有）
    if (template.styleTemplate) {
      fullTemplate += "\n\n" + template.styleTemplate;
    }
    
    // 添加政策模板（如果有）
    if (template.policyTemplate) {
      fullTemplate += "\n\n" + template.policyTemplate;
    }
    
    // 应用模板变量
    return this.applyPromptTemplate(fullTemplate, userInput, contextMemories, searchResults);
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
    let processedPrompt = promptTemplate;
    
    // 替换用户输入变量
    processedPrompt = processedPrompt.replace(/\{\{user_input\}\}/g, userInput);
    processedPrompt = processedPrompt.replace(/\{\{message\}\}/g, userInput);
    processedPrompt = processedPrompt.replace(/\{\{query\}\}/g, userInput);
    
    // 替换记忆上下文变量
    if (contextMemories) {
      processedPrompt = processedPrompt.replace(/\{\{memory\}\}/g, contextMemories);
      processedPrompt = processedPrompt.replace(/\{\{memories\}\}/g, contextMemories);
      processedPrompt = processedPrompt.replace(/\{\{context\}\}/g, contextMemories);
    } else {
      // 如果没有记忆上下文，替换为空或默认文本
      processedPrompt = processedPrompt.replace(/\{\{memory\}\}/g, "");
      processedPrompt = processedPrompt.replace(/\{\{memories\}\}/g, "");
      processedPrompt = processedPrompt.replace(/\{\{context\}\}/g, "");
    }
    
    // 替换搜索结果变量
    if (searchResults) {
      processedPrompt = processedPrompt.replace(/\{\{search\}\}/g, searchResults);
      processedPrompt = processedPrompt.replace(/\{\{search_results\}\}/g, searchResults);
    } else {
      // 如果没有搜索结果，替换为空或默认文本
      processedPrompt = processedPrompt.replace(/\{\{search\}\}/g, "");
      processedPrompt = processedPrompt.replace(/\{\{search_results\}\}/g, "");
    }
    
    // 替换当前日期
    const currentDate = new Date().toISOString().split('T')[0];
    processedPrompt = processedPrompt.replace(/\{\{date\}\}/g, currentDate);
    processedPrompt = processedPrompt.replace(/\{\{current_date\}\}/g, currentDate);
    
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
    let defaultPrompt = `你是一个多语言AI学习助手，专注于提供个性化的学习体验和知识分析。`;
    
    // 添加记忆上下文（如果有）
    if (contextMemories) {
      defaultPrompt += `

以下是用户的历史学习记忆和对话上下文:
${contextMemories}

请在回答时自然地融入这些上下文信息，使回答更加连贯和个性化。避免明确提及这些记忆，而是像熟悉用户的专业导师一样利用这些信息提供帮助。`;
    }
    
    // 添加搜索结果（如果有）
    if (searchResults) {
      defaultPrompt += `

以下是与用户问题相关的网络搜索结果:
${searchResults}

请根据这些搜索结果为用户提供最新、最准确的信息。`;
    }
    
    // 添加用户问题
    defaultPrompt += `

用户当前问题: ${userInput}

请提供详细、有深度的回答，体现出专业的分析和洞察。回答应当逻辑清晰、内容准确、分析深入`;
    
    if (contextMemories) {
      defaultPrompt += `，同时与用户之前的学习内容保持连贯性`;
    }
    
    if (searchResults) {
      defaultPrompt += `。引用网络搜索结果时，可以标注来源编号[1],[2]等`;
    }
    
    defaultPrompt += `。`;
    
    return defaultPrompt;
  }
}

export const promptManagerService = new PromptManagerService();