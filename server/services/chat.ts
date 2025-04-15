import fetch from "node-fetch";
import { log } from "../vite";
import { storage } from "../storage";
import { webSearchService, type SearchSnippet } from "./web-search";

interface ModelConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  transformRequest?: (message: string, contextMemories?: string, searchResults?: string) => any;
  isSimulated: boolean;
  getResponse: (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => Promise<{ text: string; model: string }>;
}

interface Memory {
  content: string;
  type: string;
  timestamp: string;
  embedding?: number[];
  summary?: string;   // 内容摘要
  keywords?: string[];  // 关键词列表
}

export class ChatService {
  private apiKey: string;
  private currentModel: string;
  private modelConfigs: Record<string, ModelConfig>;
  private useWebSearch: boolean = false;

  constructor() {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      throw new Error("DIFY_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.currentModel = "deep"; // Default model
    log("ChatService initialized");

    this.modelConfigs = {
      gemini: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: false,
        transformRequest: (message: string, contextMemories?: string, searchResults?: string) => {
          // 构建基础提示词
          let basePrompt = `你是一个先进的AI学习助手，能够提供个性化学习体验。`;
          
          // 添加记忆上下文（如果有）
          if (contextMemories) {
            basePrompt += `
            
以下是用户的历史学习记忆和对话上下文。请在回答用户当前问题时，自然地融入这些上下文信息，使回答更加连贯和个性化。
不要明确提及"根据你的历史记忆"或"根据你之前提到的"等字眼，而是像熟悉用户的导师一样自然地利用这些信息提供帮助。

为用户构建知识图谱:
${contextMemories}`;
          }
          
          // 添加搜索结果（如果有）
          if (searchResults) {
            basePrompt += `
            
${searchResults}`;
          }
          
          // 添加用户问题
          basePrompt += `

用户当前问题: ${message}

请提供详细、有帮助的回答，体现出你了解用户的学习历程。回答应当清晰、准确、富有教育意义`;
          
          if (contextMemories) {
            basePrompt += `，同时与用户之前的学习轨迹保持连贯性`;
          }
          
          if (searchResults) {
            basePrompt += `。引用网络搜索结果时，可以标注来源编号`;
          }
          
          basePrompt += `。`;
            
          return {
            query: basePrompt,
            response_mode: "blocking",
            conversation_id: null,
            user: "user",
            inputs: {},
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string) => {
          const transformedMessage = this.modelConfigs.gemini.transformRequest!(message, contextMemories, searchResults);
          log(`Calling Dify API with message: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
          
          const response = await fetchWithRetry(this.modelConfigs.gemini.endpoint!, {
            method: "POST",
            headers: this.modelConfigs.gemini.headers!,
            body: JSON.stringify(transformedMessage),
            timeout: 30000, // 30秒超时
          }, 3, 500);

          if (!response.ok) {
            const errorText = await response.text();
            log(`Dify API error: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }

          const data: any = await response.json();
          log(`Received Dify API response: ${JSON.stringify(data)}`);
          return {
            text: data.answer || "Gemini暂时无法回应",
            model: "gemini"
          };
        }
      },
      deepseek: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
          // 模拟使用记忆和搜索结果生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          const searchInfo = (useWebSearch && searchResults) ? `[使用了网络搜索结果]` : '';
          
          log(`Simulating Deepseek response for: ${message} ${memoryInfo} ${searchInfo}`);
          
          let responseText = `[Deepseek模型] `;
          
          if (memoryInfo) {
            responseText += memoryInfo + ' ';
          }
          
          if (searchInfo) {
            responseText += searchInfo + ' ';
          }
          
          responseText += `分析您的问题："${message}"...\n\n`;
          
          if (useWebSearch && searchResults) {
            responseText += `根据网络搜索结果，我发现以下信息：\n\n`;
            responseText += `1. 您的问题涉及到的核心概念有多个不同的解释。\n`;
            responseText += `2. 多数权威来源强调了这个主题的重要性和应用场景。\n`;
            responseText += `3. 根据[1]来源，最佳实践包括系统化的学习方法和定期复习。\n\n`;
          }
          
          responseText += `这是一个模拟的Deepseek回应，实际情况下会提供更详细的解答。`;
          
          return {
            text: responseText,
            model: "deepseek"
          };
        }
      },
      grok: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
          // 模拟使用记忆和搜索结果生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          const searchInfo = (useWebSearch && searchResults) ? `[使用了网络搜索结果]` : '';
          
          log(`Simulating Grok response for: ${message} ${memoryInfo} ${searchInfo}`);
          
          let responseText = `[Grok模型] `;
          
          if (memoryInfo) {
            responseText += memoryInfo + ' ';
          }
          
          if (searchInfo) {
            responseText += searchInfo + ' ';
          }
          
          responseText += `处理您的问题："${message}"...\n\n`;
          
          if (useWebSearch && searchResults) {
            responseText += `基于网络搜索的最新信息表明：\n\n`;
            responseText += `• 您询问的主题有多个维度的考量\n`;
            responseText += `• 最新研究指出了一些创新方法\n`;
            responseText += `• 参考[2]来源，有专家提出了新的理论框架\n\n`;
          }
          
          responseText += `这是一个模拟的Grok回应，仅作演示用途。`;
          
          return {
            text: responseText,
            model: "grok"
          };
        }
      },
      search: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
          // 这个模型强制启用搜索，不论全局设置如何
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          const searchInfo = searchResults ? `[使用了网络搜索结果]` : '[尝试网络搜索]';
          
          log(`Simulating Search response for: ${message} ${memoryInfo} ${searchInfo}`);
          
          let responseText = `[Search模型] `;
          
          if (memoryInfo) {
            responseText += memoryInfo + ' ';
          }
          
          responseText += searchInfo + ' ';
          responseText += `搜索您的问题："${message}"...\n\n`;
          
          if (searchResults) {
            responseText += `根据网络搜索结果，我找到了如下信息：\n\n`;
            responseText += `[1] 您的问题在多个领域都有相关研究和应用\n`;
            responseText += `[2] 主流观点认为这是一个复杂的主题，需要多角度分析\n`;
            responseText += `[3] 最新的研究成果指出了一些创新的解决方案\n\n`;
            responseText += `综合以上信息，建议您可以从以下几个方面进一步探索：...\n\n`;
          } else {
            responseText += `很抱歉，当前无法获取相关的搜索结果。这可能是由于：\n`;
            responseText += `1. 网络连接问题\n`;
            responseText += `2. 搜索API限制\n`;
            responseText += `3. 查询内容可能需要更具体的关键词\n\n`;
            responseText += `您可以尝试重新提问，或者使用更具体的关键词。\n\n`;
          }
          
          responseText += `这是一个模拟的Search回应，实际系统会提供更全面的搜索结果和分析。`;
          
          return {
            text: responseText,
            model: "search"
          };
        }
      },
      deep: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
          // 模拟使用记忆和搜索结果生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          const searchInfo = (useWebSearch && searchResults) ? `[使用了网络搜索结果]` : '';
          
          log(`Simulating Deep response for: ${message} ${memoryInfo} ${searchInfo}`);
          
          let responseText = `[Deep模型] `;
          
          if (memoryInfo) {
            responseText += memoryInfo + ' ';
          }
          
          if (searchInfo) {
            responseText += searchInfo + ' ';
          }
          
          responseText += `分析您的问题："${message}"...\n\n`;
          
          if (useWebSearch && searchResults) {
            responseText += `综合网络搜索和知识库分析：\n\n`;
            responseText += `1. 这个主题有多个层次的解读\n`;
            responseText += `2. 从历史发展来看，理论框架经历了多次演变\n`;
            responseText += `3. 当前学术界对此有不同观点，引用[1]和[3]源的研究\n\n`;
          }
          
          responseText += `这是一个模拟的Deep模型回应，实际系统会提供更深入的分析和见解。`;
          
          return {
            text: responseText,
            model: "deep"
          };
        }
      }
    };
  }

  setModel(model: string) {
    if (!this.modelConfigs[model]) {
      throw new Error(`Unsupported model: ${model}`);
    }
    log(`Switching to model: ${model}`);
    this.currentModel = model;
  }
  
  /**
   * 设置是否使用网络搜索
   * @param enabled 是否启用
   */
  setWebSearchEnabled(enabled: boolean) {
    this.useWebSearch = enabled;
    log(`Web search ${enabled ? 'enabled' : 'disabled'} for chat service`);
  }
  
  /**
   * 获取模型的提示词模板
   * @param modelId 模型ID
   * @returns 提示词模板，如果不存在则返回undefined
   */
  private async getModelPromptTemplate(modelId: string): Promise<string | undefined> {
    try {
      const templateRecord = await storage.getPromptTemplate(modelId);
      if (templateRecord) {
        log(`Using prompt template for model ${modelId}`);
        return templateRecord.promptTemplate;
      }
      return undefined;
    } catch (error) {
      log(`Error getting prompt template for model ${modelId}: ${error}`);
      return undefined;
    }
  }

  // 获取相似记忆并进行上下文增强
  private async getSimilarMemories(userId: number, message: string): Promise<string | undefined> {
    try {
      log(`Retrieving similar memories for user ${userId} and message: ${message.substring(0, 50)}...`);
      
      // 使用当前服务器地址
      const response = await fetch('http://localhost:5000/api/similar-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query: message, limit: 5 }) // 增加记忆条数上限
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`Error retrieving memories: ${response.status} - ${errorText}`);
        // 失败时返回空而不是抛出异常，防止整个请求失败
        return undefined;
      }
      
      const data: { success?: boolean; memories?: Memory[] } = await response.json() as any;
      const memories = data.memories || [];
      
      if (!memories || memories.length === 0) {
        log(`No similar memories found for user ${userId}`);
        return undefined;
      }
      
      // 提取摘要和额外信息（如果有）
      const enhancedMemories = memories.map(memory => {
        const summary = memory.summary || memory.content.substring(0, 100) + (memory.content.length > 100 ? "..." : "");
        const keywords = Array.isArray(memory.keywords) ? memory.keywords.join(", ") : "";
        return {
          ...memory,
          summary,
          keywords
        };
      });
      
      // 构建增强的上下文提示（使用提示注入技术）
      const contextPreamble = `
以下是与用户当前问题相关的历史记忆，请结合这些记忆提供更加连贯、个性化的回答。
用户的记忆显示了他们之前关注的主题、问题和学习路径。使用这些记忆来提供更有针对性的回答，
但不要在回答中明确提及"根据你的记忆"或列举这些记忆内容。自然地融入这些上下文。
`;

      // 将记忆格式化为结构化字符串
      const memoryContextItems = enhancedMemories.map((memory, index) => {
        // 使用摘要、关键词和时间戳构建更丰富的记忆表示
        const timestamp = memory.timestamp ? new Date(memory.timestamp).toLocaleString() : "未知时间";
        const keywordInfo = memory.keywords ? `[关键词: ${memory.keywords}]` : "";
        
        return `记忆片段 ${index + 1} (${timestamp}) ${keywordInfo}:\n${memory.summary || memory.content}`;
      });
      
      // 合并所有上下文
      const memoryContext = contextPreamble + '\n\n' + memoryContextItems.join('\n\n');
      
      log(`Retrieved and enhanced ${memories.length} similar memories`);
      return memoryContext;
    } catch (error) {
      log(`Error in getSimilarMemories: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * 获取网络搜索结果
   * @param query 搜索查询
   */
  private async getWebSearchResults(query: string): Promise<string | undefined> {
    if (!this.useWebSearch) {
      return undefined;
    }
    
    try {
      log(`Performing web search for query: ${query}`);
      const searchResults = await webSearchService.search(query);
      
      if (!searchResults || searchResults.length === 0) {
        log(`No search results found for query: ${query}`);
        return undefined;
      }
      
      const formattedResults = webSearchService.formatSearchContext(searchResults);
      log(`Retrieved ${searchResults.length} search results`);
      
      return formattedResults;
    } catch (error) {
      log(`Error in web search: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  
  /**
   * 应用提示词注入和变量插值
   * @param promptTemplate 提示词模板
   * @param message 用户消息
   * @param contextMemories 记忆上下文
   * @param searchResults 搜索结果
   */
  private applyPromptTemplate(
    promptTemplate: string,
    message: string,
    contextMemories?: string,
    searchResults?: string
  ): string {
    // 替换模板变量
    let processedPrompt = promptTemplate
      .replace(/{{user_input}}/g, message)
      .replace(/{{date}}/g, new Date().toLocaleString())
      .replace(/{{memory}}/g, contextMemories || "")
      .replace(/{{search}}/g, searchResults || "");
    
    // 处理条件部分，格式为 {{#if memory}} 内容 {{/if}}
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

  async sendMessage(message: string, userId?: number, useWebSearch?: boolean) {
    try {
      // 如果提供了参数，则更新搜索设置
      if (useWebSearch !== undefined) {
        this.setWebSearchEnabled(useWebSearch);
      }
      
      log(`Processing message with ${this.currentModel} model: ${message}, web search: ${this.useWebSearch}`);
      const config = this.modelConfigs[this.currentModel];
      
      // 如果有用户ID，尝试获取相似记忆
      let contextMemories: string | undefined = undefined;
      if (userId) {
        contextMemories = await this.getSimilarMemories(userId, message);
      }
      
      // 如果启用了网络搜索，获取搜索结果
      let searchResults: string | undefined = undefined;
      if (this.useWebSearch) {
        searchResults = await this.getWebSearchResults(message);
      }
      
      // 尝试获取模型的提示词模板
      const promptTemplate = await this.getModelPromptTemplate(this.currentModel);
      
      // 如果有提示词模板，应用模板
      if (promptTemplate) {
        const processedPrompt = this.applyPromptTemplate(
          promptTemplate,
          message,
          contextMemories,
          searchResults
        );
        
        log(`Applied prompt template for model ${this.currentModel}`);
        
        // 使用处理后的提示词
        return await config.getResponse(processedPrompt, userId, contextMemories, searchResults, this.useWebSearch);
      }
      
      // 使用默认处理（无模板）
      return await config.getResponse(message, userId, contextMemories, searchResults, this.useWebSearch);
    } catch (error) {
      log(`Error in ${this.currentModel} chat: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const chatService = new ChatService();

// 添加重试逻辑，避免504超时问题
const fetchWithRetry = async (url: string, options: any, retries = 3, backoff = 300) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // 如果服务器返回504，等待后重试
      if (response.status === 504) {
        lastError = new Error(`Gateway timeout (504) on attempt ${i + 1} of ${retries}`);
        log(`Gateway timeout, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; // 指数退避策略
        continue;
      }
      
      // 其他错误直接返回
      return response;
    } catch (error) {
      lastError = error;
      log(`Network error on attempt ${i + 1} of ${retries}: ${error}`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
  
  // 所有重试都失败了
  throw lastError || new Error('Failed after retries');
};
