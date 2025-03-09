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
          messages: [{
            role: "user",
            content: message
          }],
          response_mode: "streaming",
        }),
      });

      if (!response.ok) {
        throw new Error(`Dify API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error calling Dify API:", error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
