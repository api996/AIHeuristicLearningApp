import fetch from "node-fetch";

interface ModelConfig {
  endpoint: string;
  headers: Record<string, string>;
  transformRequest: (message: string) => any;
  transformResponse: (data: any) => { text: string; model: string };
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

    this.modelConfigs = {
      gemini: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        transformRequest: (message: string) => ({
          query: message,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        transformResponse: (data: any) => ({
          text: data.answer || "无法获取回复",
          model: "gemini"
        })
      },
      // Mock configurations for other models
      search: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        transformRequest: (message: string) => ({
          query: `搜索: ${message}`,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        transformResponse: (data: any) => ({
          text: data.answer || "搜索结果暂时无法获取",
          model: "search"
        })
      },
      deep: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        transformRequest: (message: string) => ({
          query: `深度分析: ${message}`,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        transformResponse: (data: any) => ({
          text: data.answer || "深度分析暂时无法完成",
          model: "deep"
        })
      },
      deepseek: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        transformRequest: (message: string) => ({
          query: `Deepseek分析: ${message}`,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        transformResponse: (data: any) => ({
          text: data.answer || "Deepseek分析暂时无法完成",
          model: "deepseek"
        })
      },
      grok: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        transformRequest: (message: string) => ({
          query: `Grok分析: ${message}`,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
        transformResponse: (data: any) => ({
          text: data.answer || "Grok分析暂时无法完成",
          model: "grok"
        })
      }
    };
  }

  setModel(model: string) {
    if (!this.modelConfigs[model]) {
      throw new Error(`Unsupported model: ${model}`);
    }
    this.currentModel = model;
  }

  async sendMessage(message: string) {
    try {
      const config = this.modelConfigs[this.currentModel];

      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify(config.transformRequest(message)),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return config.transformResponse(data);
    } catch (error) {
      console.error(`Error in ${this.currentModel} chat:`, error);
      throw error;
    }
  }
}

export const chatService = new ChatService();