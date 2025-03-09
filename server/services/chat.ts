import fetch from "node-fetch";

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
          const response = await fetch(this.modelConfigs.gemini.endpoint!, {
            method: "POST",
            headers: this.modelConfigs.gemini.headers!,
            body: JSON.stringify(this.modelConfigs.gemini.transformRequest!(message)),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
          }

          const data = await response.json();
          return {
            text: data.answer || "Gemini暂时无法回应",
            model: "gemini"
          };
        }
      },
      deepseek: {
        isSimulated: true,
        getResponse: async (message: string) => ({
          text: `[Deepseek模型] 分析您的问题："${message}"...\n这是一个模拟的Deepseek回应。`,
          model: "deepseek"
        })
      },
      grok: {
        isSimulated: true,
        getResponse: async (message: string) => ({
          text: `[Grok模型] 处理您的问题："${message}"...\n这是一个模拟的Grok回应。`,
          model: "grok"
        })
      },
      search: {
        isSimulated: true,
        getResponse: async (message: string) => ({
          text: `[Search模型] 搜索您的问题："${message}"...\n这是一个模拟的Search回应。`,
          model: "search"
        })
      },
      deep: {
        isSimulated: true,
        getResponse: async (message: string) => ({
          text: `[Deep模型] 分析您的问题："${message}"...\n这是一个模拟的Deep回应。`,
          model: "deep"
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
      return await config.getResponse(message);
    } catch (error) {
      console.error(`Error in ${this.currentModel} chat:`, error);
      throw error;
    }
  }
}

export const chatService = new ChatService();