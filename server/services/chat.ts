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
          // 如果有记忆上下文，就添加到请求中
          const query = contextMemories
            ? `我需要你基于以下历史记忆回答用户的问题。\n\n历史记忆:\n${contextMemories}\n\n用户问题: ${message}`
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

  // 获取相似记忆
  private async getSimilarMemories(userId: number, message: string): Promise<string | undefined> {
    try {
      log(`Retrieving similar memories for user ${userId} and message: ${message.substring(0, 50)}...`);
      
      // 使用当前服务器地址
      const response = await fetch('http://localhost:5000/api/similar-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, query: message, limit: 3 })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`Error retrieving memories: ${response.status} - ${errorText}`);
        return undefined;
      }
      
      const data: { success?: boolean; memories?: Memory[] } = await response.json() as any;
      const memories = data.memories || [];
      
      if (!memories || memories.length === 0) {
        log(`No similar memories found for user ${userId}`);
        return undefined;
      }
      
      // 将记忆格式化为字符串
      const memoryContext = memories.map((memory, index) => {
        return `记忆 ${index + 1} [${memory.type}]: ${memory.content}`;
      }).join('\n\n');
      
      log(`Retrieved ${memories.length} similar memories`);
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
