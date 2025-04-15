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
    // 检查必要的API密钥
    const difyApiKey = process.env.DIFY_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const serperApiKey = process.env.SERPER_API_KEY;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const grokApiKey = process.env.GROK_API_KEY;
    
    // 记录可用的模型API密钥
    const availableKeys = [
      difyApiKey ? "DIFY_API_KEY" : null,
      geminiApiKey ? "GEMINI_API_KEY" : null,
      serperApiKey ? "SERPER_API_KEY" : null,
      deepseekApiKey ? "DEEPSEEK_API_KEY" : null,
      grokApiKey ? "GROK_API_KEY" : null
    ].filter(Boolean);
    
    log(`ChatService 初始化，可用API: ${availableKeys.join(", ")}`);
    
    // 默认使用deep模型
    this.currentModel = "deep";
    this.apiKey = difyApiKey || "";
    
    this.modelConfigs = {
      gemini: {
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`,
        headers: {
          "Content-Type": "application/json",
        },
        isSimulated: !geminiApiKey,
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
            contents: [
              {
                parts: [
                  {
                    text: basePrompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 4096,
            }
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string) => {
          // 如果没有API密钥，返回模拟响应
          if (!geminiApiKey) {
            log(`No Gemini API key found, returning simulated response`);
            const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
            const searchInfo = (searchResults) ? `[使用了网络搜索结果]` : '';
            
            let responseText = `[Gemini模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            if (searchInfo) responseText += searchInfo + ' ';
            
            responseText += `处理您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的Gemini响应，因为尚未配置有效的API密钥。当API密钥配置后，此处将显示真实的Gemini AI生成内容。`;
            
            return {
              text: responseText,
              model: "gemini"
            };
          }
          
          try {
            const transformedMessage = this.modelConfigs.gemini.transformRequest!(message, contextMemories, searchResults);
            log(`Calling Gemini API with message: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
            
            const url = `${this.modelConfigs.gemini.endpoint}?key=${geminiApiKey}`;
            const response = await fetchWithRetry(url, {
              method: "POST",
              headers: this.modelConfigs.gemini.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 30000, // 30秒超时
            }, 3, 500);

            if (!response.ok) {
              const errorText = await response.text();
              log(`Gemini API error: ${response.status} - ${errorText}`);
              throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`Received Gemini API response`);
            
            // 提取响应文本
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini模型无法生成回应";
            
            return {
              text: responseText,
              model: "gemini"
            };
          } catch (error) {
            log(`Error calling Gemini API: ${error}`);
            throw error;
          }
        }
      },
      deepseek: {
        endpoint: `https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/2c5a0480-1681-4d95-a199-995301f8ad61`,
        headers: {
          "Authorization": `Bearer ${deepseekApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !deepseekApiKey,
        transformRequest: (message: string, contextMemories?: string, searchResults?: string) => {
          // 构建基础提示词
          let basePrompt = `你是一个先进的AI学习助手DeepSeek，专注于深度分析和详细解释。`;
          
          // 添加记忆上下文（如果有）
          if (contextMemories) {
            basePrompt += `
            
以下是用户的历史学习记忆和对话上下文:
${contextMemories}

请在回答时自然地融入这些上下文信息，使回答更加深入和个性化。`;
          }
          
          // 添加搜索结果（如果有）
          if (searchResults) {
            basePrompt += `
            
以下是与用户问题相关的网络搜索结果:
${searchResults}

请根据这些搜索结果为用户提供准确的信息。`;
          }
          
          // 添加用户问题
          basePrompt += `

用户当前问题: ${message}

请提供详细、有深度的回答，体现出专业的洞察力。回答应当结构清晰、内容全面、分析深入`;
          
          if (contextMemories) {
            basePrompt += `，同时与用户之前的学习轨迹保持连贯性`;
          }
          
          if (searchResults) {
            basePrompt += `。引用网络搜索结果时，可以标注来源编号`;
          }
          
          basePrompt += `。`;
            
          // 适配NVIDIA NIM平台的API格式
          return {
            input: {
              prompt: basePrompt,
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 4096
            }
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string) => {
          // 如果没有API密钥，返回模拟响应
          if (!deepseekApiKey) {
            log(`No DeepSeek API key found, returning simulated response`);
            const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
            const searchInfo = (searchResults) ? `[使用了网络搜索结果]` : '';
            
            let responseText = `[DeepSeek模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            if (searchInfo) responseText += searchInfo + ' ';
            
            responseText += `分析您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的DeepSeek响应，因为尚未配置有效的API密钥。当API密钥配置后，此处将显示真实的DeepSeek AI生成内容。`;
            
            return {
              text: responseText,
              model: "deepseek"
            };
          }
          
          try {
            const transformedMessage = this.modelConfigs.deepseek.transformRequest!(message, contextMemories, searchResults);
            log(`Calling DeepSeek API (NVIDIA NIM) with message: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
            
            const response = await fetchWithRetry(this.modelConfigs.deepseek.endpoint!, {
              method: "POST",
              headers: this.modelConfigs.deepseek.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 60000, // 60秒超时，因为大模型推理可能需要更长时间
            }, 3, 1000);

            if (!response.ok) {
              const errorText = await response.text();
              log(`DeepSeek API error: ${response.status} - ${errorText}`);
              throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`Received DeepSeek API response`);
            
            // NVIDIA NIM平台的响应格式处理
            const responseText = data.output?.text || data.output || "DeepSeek模型无法生成回应";
            
            return {
              text: responseText,
              model: "deepseek"
            };
          } catch (error) {
            log(`Error calling DeepSeek API: ${error}`);
            throw error;
          }
        }
      },
      grok: {
        endpoint: `https://api.xai-grok.com/v1/chat/completions`,
        headers: {
          "Authorization": `Bearer ${grokApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !grokApiKey,
        transformRequest: (message: string, contextMemories?: string, searchResults?: string) => {
          // 构建系统提示
          let systemPrompt = `你是Grok，一个先进的AI助手，来自XAI公司，具有幽默感和独特见解。你的回答应该既有信息量又有趣味性。`;
          
          // 构建用户提示
          let userPrompt = message;
          
          // 添加记忆上下文（如果有）
          if (contextMemories) {
            systemPrompt += `\n\n以下是用户的历史学习记忆，请在回答时自然地利用这些信息提供个性化帮助：\n${contextMemories}`;
          }
          
          // 添加搜索结果（如果有）
          if (searchResults) {
            userPrompt = `我的问题是: ${message}\n\n这是一些相关的网络搜索结果:\n${searchResults}\n\n请使用这些信息来帮助我回答问题，但不要明确提及你在使用搜索结果。`;
          }
            
          return {
            model: "grok-1",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4096
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string) => {
          // 如果没有API密钥，返回模拟响应
          if (!grokApiKey) {
            log(`No Grok API key found, returning simulated response`);
            const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
            const searchInfo = (searchResults) ? `[使用了网络搜索结果]` : '';
            
            let responseText = `[Grok模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            if (searchInfo) responseText += searchInfo + ' ';
            
            responseText += `处理您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的Grok响应，因为尚未配置有效的API密钥。当API密钥配置后，此处将显示真实的Grok AI生成内容。`;
            
            return {
              text: responseText,
              model: "grok"
            };
          }
          
          try {
            const transformedMessage = this.modelConfigs.grok.transformRequest!(message, contextMemories, searchResults);
            log(`Calling Grok API with message: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
            
            const response = await fetchWithRetry(this.modelConfigs.grok.endpoint!, {
              method: "POST",
              headers: this.modelConfigs.grok.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 60000, // 60秒超时
            }, 3, 1000);

            if (!response.ok) {
              const errorText = await response.text();
              log(`Grok API error: ${response.status} - ${errorText}`);
              throw new Error(`Grok API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`Received Grok API response`);
            
            // 提取响应文本
            const responseText = data.choices?.[0]?.message?.content || "Grok模型无法生成回应";
            
            return {
              text: responseText,
              model: "grok"
            };
          } catch (error) {
            log(`Error calling Grok API: ${error}`);
            throw error;
          }
        }
      },
      search: {
        endpoint: `https://api.serper.dev/search`,
        headers: {
          "X-API-KEY": serperApiKey || "",
          "Content-Type": "application/json",
        },
        isSimulated: !serperApiKey,
        transformRequest: (message: string, contextMemories?: string, searchResults?: string) => {
          return {
            q: message,
            gl: "us",
            hl: "en",
            num: 10
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string) => {
          // 这个模型强制启用搜索，不论全局设置如何
          const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
          
          // 如果没有API密钥，返回模拟响应
          if (!serperApiKey) {
            log(`No Serper API key found, returning simulated response`);
            let responseText = `[Search模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            responseText += `[尝试网络搜索] `;
            responseText += `搜索您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的Search响应，因为尚未配置有效的SERPER_API_KEY。配置密钥后，将显示真实的搜索结果。`;
            
            return {
              text: responseText,
              model: "search"
            };
          }
          
          try {
            // 直接使用搜索服务进行搜索
            log(`Search model performing web search for: ${message}`);
            const searchResults = await webSearchService.search(message);
            
            let responseText = `[Search模型] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            
            if (!searchResults || searchResults.length === 0) {
              responseText += `[无搜索结果] 搜索您的问题："${message}"...\n\n`;
              responseText += `很抱歉，当前无法获取相关的搜索结果。这可能是由于：\n`;
              responseText += `1. 查询内容可能需要更具体的关键词\n`;
              responseText += `2. 该主题可能缺乏公开资料\n`;
              responseText += `3. 搜索服务暂时限制\n\n`;
              responseText += `您可以尝试重新提问，或者使用更具体的关键词。`;
            } else {
              responseText += `[使用了网络搜索结果] 搜索您的问题："${message}"...\n\n`;
              responseText += `根据网络搜索结果，我找到了以下信息：\n\n`;
              
              // 格式化搜索结果
              searchResults.forEach((result, idx) => {
                const title = result.title || '无标题';
                const snippet = result.snippet || '无详细描述';
                const url = result.url || '无链接';
                
                responseText += `[${idx + 1}] ${title}\n`;
                responseText += `${snippet}\n`;
                responseText += `来源: ${url}\n\n`;
              });
              
              // 添加总结
              responseText += `以上是关于"${message}"的搜索结果摘要。您可以从这些信息中获取最新的、客观的参考资料。如需更详细的信息，可以访问提供的链接。`;
            }
            
            return {
              text: responseText,
              model: "search"
            };
          } catch (error) {
            log(`Error in search model: ${error}`);
            throw error;
          }
        }
      },
      deep: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${difyApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !difyApiKey,
        transformRequest: (message: string, contextMemories?: string, searchResults?: string) => {
          // 构建基础提示词
          let basePrompt = `你是一个多语言AI学习助手，专注于提供深入的学习体验和知识分析。`;
          
          // 添加记忆上下文（如果有）
          if (contextMemories) {
            basePrompt += `
            
以下是用户的历史学习记忆和对话上下文:
${contextMemories}

请在回答时自然地融入这些上下文信息，使回答更加连贯和个性化。避免明确提及这些记忆，而是像熟悉用户的专业导师一样利用这些信息提供帮助。`;
          }
          
          // 添加搜索结果（如果有）
          if (searchResults) {
            basePrompt += `
            
以下是与用户问题相关的网络搜索结果:
${searchResults}

请根据这些搜索结果为用户提供最新、最准确的信息。`;
          }
          
          // 添加用户问题和回答指导
          basePrompt += `

用户当前问题: ${message}

请提供详细、有深度的回答，体现出专业的分析和洞察。回答应当逻辑清晰、内容准确、分析深入`;
          
          if (contextMemories) {
            basePrompt += `，同时与用户之前的学习内容保持连贯性`;
          }
          
          if (searchResults) {
            basePrompt += `。引用网络搜索结果时，可以标注来源编号[1],[2]等`;
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
          // 如果没有API密钥，返回模拟响应
          if (!difyApiKey) {
            log(`No Dify API key found, returning simulated response`);
            const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
            const searchInfo = (searchResults) ? `[使用了网络搜索结果]` : '';
            
            let responseText = `[Deep模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            if (searchInfo) responseText += searchInfo + ' ';
            
            responseText += `分析您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的Deep响应，因为尚未配置有效的Dify API密钥。当API密钥配置后，此处将显示真实的Dify AI生成内容。`;
            
            return {
              text: responseText,
              model: "deep"
            };
          }
          
          try {
            const transformedMessage = this.modelConfigs.deep.transformRequest!(message, contextMemories, searchResults);
            log(`Calling Dify API with message: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
            
            const response = await fetchWithRetry(this.modelConfigs.deep.endpoint!, {
              method: "POST",
              headers: this.modelConfigs.deep.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 30000, // 30秒超时
            }, 3, 500);

            if (!response.ok) {
              const errorText = await response.text();
              log(`Dify API error: ${response.status} - ${errorText}`);
              throw new Error(`Dify API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`Received Dify API response`);
            
            return {
              text: data.answer || "Deep模型暂时无法回应",
              model: "deep"
            };
          } catch (error) {
            log(`Error calling Dify API: ${error}`);
            throw error;
          }
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
