import fetch from "node-fetch";
import { log } from "../vite";

interface ModelConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  transformRequest?: (message: string) => any;
  isSimulated: boolean;
  getResponse: (message: string) => Promise<{ text: string; model: string }>;
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
        transformRequest: (message: string) => ({
          query: message,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        getResponse: async (message: string) => {
          log(`Calling Dify API with message: ${message}`);
          const response = await fetchWithRetry(this.modelConfigs.gemini.endpoint!, {
            method: "POST",
            headers: this.modelConfigs.gemini.headers!,
            body: JSON.stringify(this.modelConfigs.gemini.transformRequest!(message)),
            timeout: 30000, // 30秒超时
          }, 3, 500);

          if (!response.ok) {
            const errorText = await response.text();
            log(`Dify API error: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          log(`Received Dify API response: ${JSON.stringify(data)}`);
          return {
            text: data.answer || "Gemini暂时无法回应",
            model: "gemini"
          };
        }
      },
      deepseek: {
        isSimulated: true,
        getResponse: async (message: string) => {
          log(`Simulating Deepseek response for: ${message}`);
          return {
            text: `[Deepseek模型] 分析您的问题："${message}"...\n这是一个模拟的Deepseek回应。`,
            model: "deepseek"
          };
        }
      },
      grok: {
        isSimulated: true,
        getResponse: async (message: string) => {
          log(`Simulating Grok response for: ${message}`);
          return {
            text: `[Grok模型] 处理您的问题："${message}"...\n这是一个模拟的Grok回应。`,
            model: "grok"
          };
        }
      },
      search: {
        isSimulated: true,
        getResponse: async (message: string) => {
          log(`Simulating Search response for: ${message}`);
          return {
            text: `[Search模型] 搜索您的问题："${message}"...\n这是一个模拟的Search回应。`,
            model: "search"
          };
        }
      },
      deep: {
        isSimulated: true,
        getResponse: async (message: string) => {
          log(`Simulating Deep response for: ${message}`);
          return {
            text: `[Deep模型] 分析您的问题："${message}"...\n这是一个模拟的Deep回应。`,
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

  async sendMessage(message: string) {
    try {
      log(`Processing message with ${this.currentModel} model: ${message}`);
      const config = this.modelConfigs[this.currentModel];
      return await config.getResponse(message);
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
