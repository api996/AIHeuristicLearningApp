import fetch from "node-fetch";

const DIFY_API_BASE_URL = "https://api.dify.ai/v1";

export class ChatService {
  private apiKey: string;
  private currentModel: string;

  constructor() {
    const apiKey = process.env.DIFY_API_KEY;
    if (!apiKey) {
      throw new Error("DIFY_API_KEY is required");
    }
    this.apiKey = apiKey;
    this.currentModel = "default"; // Default model
  }

  setModel(model: string) {
    this.currentModel = model;
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
          query: message,
          response_mode: "blocking",
          conversation_id: null,
          user: "user",
          inputs: {},
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dify API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return {
        text: data.answer,
        model: this.currentModel,
      };
    } catch (error) {
      console.error("Error calling Dify API:", error);
      throw error;
    }
  }
}

export const chatService = new ChatService();