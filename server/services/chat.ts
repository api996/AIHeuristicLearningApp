import fetch from "node-fetch";
import { log } from "../vite";

interface ModelConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  transformRequest?: (message: string, contextMemories?: string) => any;
  isSimulated: boolean;
  getResponse: (message: string, userId?: number, contextMemories?: string) => Promise<{ text: string; model: string }>;
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
        transformRequest: (message: string, contextMemories?: string) => {
          // 使用提示注入技术构建更有针对性的上下文
          const query = contextMemories
            ? `你是一个先进的AI学习助手，能够提供个性化学习体验。
            
以下是用户的历史学习记忆和对话上下文。请在回答用户当前问题时，自然地融入这些上下文信息，使回答更加连贯和个性化。
不要明确提及"根据你的历史记忆"或"根据你之前提到的"等字眼，而是像熟悉用户的导师一样自然地利用这些信息提供帮助。

为用户构建知识图谱:
${contextMemories}

用户当前问题: ${message}

请提供详细、有帮助的回答，体现出你了解用户的学习历程。回答应当清晰、准确、富有教育意义，同时与用户之前的学习轨迹保持连贯性。`
            : message;
            
          return {
            query,
            response_mode: "blocking",
            conversation_id: null,
            user: "user",
            inputs: {},
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string) => {
          const transformedMessage = this.modelConfigs.gemini.transformRequest!(message, contextMemories);
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
        getResponse: async (message: string, userId?: number, contextMemories?: string) => {
          // 模拟使用记忆生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          log(`Simulating Deepseek response for: ${message} ${memoryInfo}`);
          return {
            text: `[Deepseek模型] ${memoryInfo} 分析您的问题："${message}"...\n这是一个模拟的Deepseek回应。`,
            model: "deepseek"
          };
        }
      },
      grok: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string) => {
          // 模拟使用记忆生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          log(`Simulating Grok response for: ${message} ${memoryInfo}`);
          return {
            text: `[Grok模型] ${memoryInfo} 处理您的问题："${message}"...\n这是一个模拟的Grok回应。`,
            model: "grok"
          };
        }
      },
      search: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string) => {
          // 模拟使用记忆生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          log(`Simulating Search response for: ${message} ${memoryInfo}`);
          return {
            text: `[Search模型] ${memoryInfo} 搜索您的问题："${message}"...\n这是一个模拟的Search回应。`,
            model: "search"
          };
        }
      },
      deep: {
        isSimulated: true,
        getResponse: async (message: string, userId?: number, contextMemories?: string) => {
          // 模拟使用记忆生成回复
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          log(`Simulating Deep response for: ${message} ${memoryInfo}`);
          return {
            text: `[Deep模型] ${memoryInfo} 分析您的问题："${message}"...\n这是一个模拟的Deep回应。`,
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
        return undefined;} - ${errorText}`);
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

  async sendMessage(message: string, userId?: number) {
    try {
      log(`Processing message with ${this.currentModel} model: ${message}`);
      const config = this.modelConfigs[this.currentModel];
      
      // 如果有用户ID，尝试获取相似记忆
      let contextMemories: string | undefined = undefined;
      if (userId) {
        contextMemories = await this.getSimilarMemories(userId, message);
      }
      
      // 使用可能的记忆上下文发送消息
      return await config.getResponse(message, userId, contextMemories);
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
