import fetch from "node-fetch";

const DIFY_API_BASE_URL = "https://api.dify.ai/v1";

export class ChatService {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      throw new Error("DIFY_API_KEY is required");
    }
    this.apiKey = apiKey;
  }

  async sendMessage(message: string) {
    try {
      const response = await fetch(`${DIFY_API_BASE_URL}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: {},
          query: message,
          response_mode: "blocking",
          user: "default",
        }),
      });

      if (!response.ok) {
        // For testing without API, return a mock response
        return {
          answer: "这是一个模拟回复。系统正在测试中，稍后将连接到真实的AI服务。",
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error calling Dify API:", error);
      // Return a mock response for testing
      return {
        answer: "系统暂时无法连接AI服务，这是一个模拟回复。请稍后再试。",
      };
    }
  }
}

export const chatService = new ChatService();