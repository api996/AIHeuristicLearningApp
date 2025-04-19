import fetch from "node-fetch";
import { log } from "../vite";
import { storage } from "../storage";
import { webSearchService, type SearchSnippet } from "./web-search";
import { promptManagerService } from "./prompt-manager";
import { conversationAnalyticsService } from "./conversation-analytics";
import { contentModerationService } from "./content-moderation";
import { type Message } from "../../shared/schema";

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
    log(`使用的模型版本: Gemini-2.5-Pro-Exp-03-25, DeepSeek-R1, Grok-3-Fast-Beta`);
    
    // 默认使用Gemini模型
    this.currentModel = "gemini";
    this.apiKey = difyApiKey || "";
    
    this.modelConfigs = {
      gemini: {
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent`,
        headers: {
          "Content-Type": "application/json",
        },
        isSimulated: !geminiApiKey,
        transformRequest: async (message: string, contextMemories?: string, searchResults?: string) => {
          // 获取Gemini的提示词模板（如果有）
          let basePrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('gemini');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for Gemini model');
              basePrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              basePrompt = basePrompt
                .replace(/{{user_input}}/g, message)
                .replace(/{{date}}/g, new Date().toLocaleString())
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "");
              
              // 处理条件部分
              basePrompt = basePrompt.replace(
                /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
                contextMemories ? "$1" : ""
              );
              
              basePrompt = basePrompt.replace(
                /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
                searchResults ? "$1" : ""
              );
            }
          } catch (error) {
            log(`Error getting Gemini template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!basePrompt) {
            basePrompt = `你是一个先进的AI学习助手，能够提供个性化学习体验。`;
            
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
          }
            
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
              maxOutputTokens: 8192, // 增加到8192以支持更长的响应
            }
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
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
            const transformedMessage = await this.modelConfigs.gemini.transformRequest!(message, contextMemories, searchResults);
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
        endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`,
        headers: {
          "Authorization": `Bearer ${deepseekApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !deepseekApiKey,
        transformRequest: async (message: string, contextMemories?: string, searchResults?: string) => {
          // 获取DeepSeek的提示词模板（如果有）
          let basePrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('deepseek');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for DeepSeek model');
              basePrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              basePrompt = basePrompt
                .replace(/{{user_input}}/g, message)
                .replace(/{{date}}/g, new Date().toLocaleString())
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "");
              
              // 处理条件部分
              basePrompt = basePrompt.replace(
                /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
                contextMemories ? "$1" : ""
              );
              
              basePrompt = basePrompt.replace(
                /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
                searchResults ? "$1" : ""
              );
            }
          } catch (error) {
            log(`Error getting DeepSeek template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!basePrompt) {
            basePrompt = `你是一个先进的AI学习助手DeepSeek，专注于深度分析和详细解释。`;
            
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
          }
            
          // 适配NVIDIA NIM平台的API格式
          return {
            model: "deepseek-ai/deepseek-r1",
            messages: [
              {
                role: "user",
                content: basePrompt
              }
            ],
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 8192 // 增加到8192以支持更长的回答
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
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
            // 详细记录API请求信息
            log(`开始准备DeepSeek API请求...`);
            const transformedMessage = await this.modelConfigs.deepseek.transformRequest!(message, contextMemories, searchResults);
            log(`DeepSeek API请求准备完成，消息长度: ${JSON.stringify(transformedMessage).length}字节`);
            log(`DeepSeek API请求目标: ${this.modelConfigs.deepseek.endpoint!}`);
            
            log(`开始向NVIDIA NIM平台发送DeepSeek API请求...`);
            log(`DeepSeek 请求完整信息 - Headers: ${JSON.stringify(this.modelConfigs.deepseek.headers!)}`);
            log(`DeepSeek 请求完整信息 - Body: ${JSON.stringify(transformedMessage).substring(0, 500)}...`);
            
            const response = await fetchWithRetry(this.modelConfigs.deepseek.endpoint!, {
              method: "POST",
              headers: this.modelConfigs.deepseek.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 300000, // 增加到300秒超时（5分钟），因为NVIDIA NIM平台反应缓慢
            }, 7, 5000); // 增加到7次重试，初始间隔5秒

            if (!response.ok) {
              const errorText = await response.text();
              log(`DeepSeek API错误: ${response.status} - ${errorText}`);
              log(`DeepSeek API请求头: ${JSON.stringify(this.modelConfigs.deepseek.headers!)}`);
              throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`);
            }

            log(`DeepSeek API响应状态码: ${response.status}`);
            let responseData;
            
            try {
              responseData = await response.json();
              log(`成功解析DeepSeek API JSON响应，字段: ${Object.keys(responseData).join(', ')}`);
            } catch (parseError) {
              const rawText = await response.text();
              log(`DeepSeek API响应解析失败: ${parseError}`);
              log(`原始响应内容(截断): ${rawText.substring(0, 200)}...`);
              throw new Error(`DeepSeek API响应解析失败: ${parseError}`);
            }
            
            // NVIDIA NIM平台的响应格式处理
            log(`处理DeepSeek响应数据...`);
            if (!responseData.choices || !responseData.choices.length) {
              log(`警告: DeepSeek响应缺少choices字段: ${JSON.stringify(responseData).substring(0, 200)}...`);
            }
            
            let responseText = responseData.choices?.[0]?.message?.content || "DeepSeek模型无法生成回应";
            log(`获取到DeepSeek原始响应文本，长度: ${responseText.length}`);
            
            // 不再使用思考过程过滤函数，直接使用原始响应
            log(`使用DeepSeek原始响应（长度: ${responseText.length}字符）`);
            
            if (!responseText.trim()) {
              log(`警告: DeepSeek响应为空`);
              responseText = "DeepSeek模型返回了空响应，请重试或选择其他模型。";
            }
            
            return {
              text: responseText,
              model: "deepseek"
            };
            
          } catch (error) {
            log(`DeepSeek处理过程出错: ${error}`);
            
            // 给用户一个友好的错误信息，告知实际错误情况
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            const friendlyMessage = `DeepSeek模型暂时无法使用：${errorMessage.includes('timeout') ? '服务响应超时' : '连接服务失败'}。请尝试使用Gemini或Grok模型，或稍后再试。`;
            
            return {
              text: friendlyMessage,
              model: "deepseek"
            };
          }
        }
      },
      grok: {
        endpoint: `https://api.x.ai/v1/chat/completions`,
        headers: {
          "Authorization": `Bearer ${grokApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !grokApiKey,
        transformRequest: async (message: string, contextMemories?: string, searchResults?: string) => {
          // 获取Grok的提示词模板（如果有）
          let systemPrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('grok');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for Grok model');
              systemPrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
            }
          } catch (error) {
            log(`Error getting Grok template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!systemPrompt) {
            systemPrompt = `你是Grok-3，一个先进的AI助手，来自XAI公司，具有幽默感和独特见解。你的回答应该既有信息量又有趣味性。`;
          }
          
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
            model: "grok-3-fast-beta",
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
            top_p: 0.9,
            max_tokens: 4096 // 增加到4096以支持更长的生成内容
          };
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
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
            const transformedMessage = await this.modelConfigs.grok.transformRequest!(message, contextMemories, searchResults);
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
            
            // 给用户一个友好的错误信息
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            const friendlyMessage = `Grok模型暂时无法使用：${errorMessage.includes('timeout') ? '服务响应超时' : '连接服务失败'}。请尝试使用Gemini或其他模型，或稍后再试。`;
            
            return {
              text: friendlyMessage,
              model: "grok"
            };
          }
        }
      },
      // search模型已移除，网络搜索现在作为辅助功能集成到其他模型中
      
      deep: {
        endpoint: `https://api.dify.ai/v1/chat-messages`,
        headers: {
          "Authorization": `Bearer ${difyApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !difyApiKey,
        transformRequest: async (message: string, contextMemories?: string, searchResults?: string) => {
          // 获取Deep的提示词模板（如果有）
          let basePrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('deep');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('使用自定义模板处理Dify请求');
              basePrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              basePrompt = basePrompt
                .replace(/{{user_input}}/g, message)
                .replace(/{{date}}/g, new Date().toLocaleString())
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "");
              
              // 处理条件部分
              basePrompt = basePrompt.replace(
                /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
                contextMemories ? "$1" : ""
              );
              
              basePrompt = basePrompt.replace(
                /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
                searchResults ? "$1" : ""
              );
            }
          } catch (error) {
            log(`获取Dify模板出错: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!basePrompt) {
            basePrompt = `你是一个多语言AI学习助手，专注于提供深入的学习体验和知识分析。`;
            
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
          }
          
          // 构建Dify API请求格式
          const requestPayload = {
            query: basePrompt,
            response_mode: "blocking",
            conversation_id: null,
            user: "user",
            inputs: {},
          };
          
          log(`Dify请求格式已构建完成，有效载荷大小: ${JSON.stringify(requestPayload).length}字节`);
          return requestPayload;
        },
        getResponse: async (message: string, userId?: number, contextMemories?: string, searchResults?: string, useWebSearch?: boolean) => {
          // 如果没有API密钥，返回模拟响应
          if (!difyApiKey) {
            log(`未找到Dify API密钥，返回模拟响应`);
            const memoryInfo = contextMemories ? `[使用了${contextMemories.split('\n').length}条相关记忆]` : '';
            const searchInfo = (searchResults) ? `[使用了网络搜索结果]` : '';
            
            let responseText = `[Dify模型-模拟] `;
            if (memoryInfo) responseText += memoryInfo + ' ';
            if (searchInfo) responseText += searchInfo + ' ';
            
            responseText += `分析您的问题："${message}"...\n\n`;
            responseText += `这是一个模拟的Dify响应，因为尚未配置有效的Dify API密钥。请在.env文件中添加DIFY_API_KEY以启用实际的Dify服务。`;
            
            return {
              text: responseText,
              model: "deep"
            };
          }
          
          try {
            // 构建转换后的消息
            const transformedMessage = await this.modelConfigs.deep.transformRequest!(message, contextMemories, searchResults);
            
            // 记录API密钥前几个字符（安全日志）
            const apiKeyPrefix = difyApiKey.substring(0, 4) + '...' + difyApiKey.substring(difyApiKey.length - 4);
            log(`调用Dify API，使用密钥: ${apiKeyPrefix}，消息长度: ${JSON.stringify(transformedMessage).length}字节`);
            log(`Dify请求: ${JSON.stringify(transformedMessage).substring(0, 200)}...`);
            
            const headers = {
              "Authorization": `Bearer ${difyApiKey}`,
              "Content-Type": "application/json",
            };
            log(`Dify请求头: ${JSON.stringify(headers)}`);
            
            // 添加更多的重试次数和更长的超时时间
            const response = await fetchWithRetry(this.modelConfigs.deep.endpoint!, {
              method: "POST",
              headers: headers,
              body: JSON.stringify(transformedMessage),
              timeout: 60000, // 增加到60秒超时
            }, 5, 1000); // 5次重试，初始间隔1秒

            // 详细记录API响应状态
            log(`Dify API响应状态: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
              const errorText = await response.text();
              log(`Dify API错误: ${response.status} - ${errorText}`);
              
              // 根据不同错误代码提供更具体的错误信息
              if (response.status === 401) {
                throw new Error(`Dify API认证失败: API密钥可能无效或已过期`);
              } else if (response.status === 429) {
                throw new Error(`Dify API请求过多: 已超出API调用频率限制`);
              } else {
                throw new Error(`Dify API错误: ${response.status} - ${errorText}`);
              }
            }

            // 尝试解析JSON响应
            let data;
            try {
              data = await response.json();
              log(`已接收Dify API响应: ${JSON.stringify(data).substring(0, 200)}...`);
            } catch (parseError) {
              log(`Dify API响应JSON解析失败: ${parseError}`);
              throw new Error(`Dify API响应格式错误: ${parseError}`);
            }
            
            // 检查响应中是否包含answer字段
            if (!data.answer && data.answer !== "") {
              log(`警告: Dify响应中没有answer字段: ${JSON.stringify(data).substring(0, 200)}...`);
            }
            
            // 获取响应文本
            let responseText = data.answer || "Dify模型暂时无法回应";
            
            // 不再使用思考过程过滤函数，直接返回原始响应
            log(`Dify响应长度: ${responseText.length}字符`);
            
            return {
              text: responseText,
              model: "deep"
            };
          } catch (error) {
            log(`调用Dify API出错: ${error}`);
            
            // 给用户一个详细的错误信息
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            let friendlyMessage;
            
            if (errorMessage.includes('timeout')) {
              friendlyMessage = `Dify模型暂时无法使用：服务响应超时。请检查您的网络连接和Dify服务状态，或尝试使用其他模型。`;
            } else if (errorMessage.includes('认证失败') || errorMessage.includes('API密钥')) {
              friendlyMessage = `Dify模型认证失败：请检查您的DIFY_API_KEY是否正确。可能需要在Dify平台上重新生成API密钥。`;
            } else if (errorMessage.includes('频率限制')) {
              friendlyMessage = `Dify API调用次数已达上限：已超出API调用频率限制，请稍后再试。`;
            } else {
              friendlyMessage = `Dify模型暂时无法使用：${errorMessage}。请尝试使用Gemini或其他模型，或稍后再试。`;
            }
            
            return {
              text: friendlyMessage,
              model: "deep"
            };
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
        // 优先使用baseTemplate，如果不存在则回退到promptTemplate
        return templateRecord.baseTemplate || templateRecord.promptTemplate;
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

  async sendMessage(message: string, userId?: number, chatId?: number, useWebSearch?: boolean) {
    try {
      // 如果提供了参数，则更新搜索设置
      if (useWebSearch !== undefined) {
        this.setWebSearchEnabled(useWebSearch);
      }
      
      log(`Processing message with ${this.currentModel} model: ${message}, web search: ${this.useWebSearch}`);
      const config = this.modelConfigs[this.currentModel];
      
      // 对用户输入进行内容审查 - 前置审查
      const userInputModerationResult = await contentModerationService.moderateUserInput(message);
      if (userInputModerationResult) {
        log(`用户输入被内容审查系统拦截，提示: ${userInputModerationResult}`);
        return {
          text: userInputModerationResult,
          model: this.currentModel
        };
      }
      
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
      
      // 如果有chatId，尝试分析当前对话阶段并获取动态提示词
      if (chatId && userId) {
        try {
          // 如果有聊天历史，获取最近的消息进行分析
          const messages = await storage.getChatMessages(chatId, userId, false);
          
          if (messages && messages.length > 0) {
            // 添加当前用户消息到分析列表（因为它还未保存到数据库）
            const currentMessage: Message = {
              content: message,
              role: "user", 
              chatId,
              id: 0, 
              createdAt: new Date(),
              model: null,
              feedback: null,
              isEdited: null
            };
            
            const messagesWithCurrent: Message[] = [
              ...messages,
              currentMessage
            ];
            
            // 分析对话阶段
            await conversationAnalyticsService.analyzeConversationPhase(chatId, messagesWithCurrent);
            
            // 使用提示词管理服务获取动态提示词
            const dynamicPrompt = await promptManagerService.getDynamicPrompt(
              this.currentModel,
              chatId,
              message,
              contextMemories,
              searchResults
            );
            
            log(`使用动态提示词模板处理消息`);
            
            // 使用动态提示词而不是原始消息
            const response = await config.getResponse(dynamicPrompt, userId, contextMemories, searchResults, this.useWebSearch);
            
            // 对模型输出进行内容审查 - 后置审查
            const modelOutputModerationResult = await contentModerationService.moderateModelOutput(response.text);
            if (modelOutputModerationResult) {
              log(`模型输出被内容审查系统拦截，提示: ${modelOutputModerationResult}`);
              return {
                text: modelOutputModerationResult,
                model: response.model
              };
            }
            
            return response;
          }
        } catch (error) {
          log(`动态提示词生成错误，回退到默认提示词: ${error}`);
          // 出错时继续使用默认提示词
        }
      }
      
      // 尝试获取模型的提示词模板
      const promptTemplate = await this.getModelPromptTemplate(this.currentModel);
      
      // 如果有提示词模板，应用模板
      let response;
      if (promptTemplate) {
        const processedPrompt = this.applyPromptTemplate(
          promptTemplate,
          message,
          contextMemories,
          searchResults
        );
        
        log(`Applied prompt template for model ${this.currentModel}`);
        
        // 使用处理后的提示词
        response = await config.getResponse(processedPrompt, userId, contextMemories, searchResults, this.useWebSearch);
      } else {
        // 使用默认处理（无模板）
        response = await config.getResponse(message, userId, contextMemories, searchResults, this.useWebSearch);
      }
      
      // 对模型输出进行内容审查 - 后置审查
      const modelOutputModerationResult = await contentModerationService.moderateModelOutput(response.text);
      if (modelOutputModerationResult) {
        log(`模型输出被内容审查系统拦截，提示: ${modelOutputModerationResult}`);
        return {
          text: modelOutputModerationResult,
          model: response.model
        };
      }
      
      return response;
    } catch (error) {
      log(`Error in ${this.currentModel} chat: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const chatService = new ChatService();

// 增强版重试逻辑，处理更多类型的超时和连接问题
const fetchWithRetry = async (url: string, options: any, retries = 3, backoff = 300) => {
  let lastError;
  let attempt = 0;
  
  // 支持自定义超时
  const timeout = options.timeout || 60000; // 默认60秒
  
  for (let i = 0; i < retries; i++) {
    attempt++;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      log(`API请求第${attempt}次尝试: ${url}`);
      
      // 创建一个可以被中断的请求
      const fetchPromise = fetch(url, options);
      
      // 创建一个超时Promise
      const timeoutPromise = new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`请求超时(${timeout}ms)`));
        }, timeout);
      });
      
      // 竞争Promise
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // 清除超时计时器
      if (timeoutId) clearTimeout(timeoutId);
      
      if (response.ok) {
        log(`API请求成功，状态码: ${response.status}`);
        return response;
      }
      
      // 处理特定错误状态码
      if (response.status === 504 || response.status === 502 || response.status === 503) {
        lastError = new Error(`服务器错误(${response.status})，第${attempt}次尝试，共${retries}次`);
        const waitTime = backoff * Math.pow(2, i); // 更平滑的退避策略
        log(`服务器错误(${response.status})，${waitTime}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      // 其他HTTP错误直接返回，让调用者处理
      log(`API请求返回非成功状态码: ${response.status}`);
      return response;
      
    } catch (error) {
      // 清除超时计时器
      if (timeoutId) clearTimeout(timeoutId);
      
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 判断是否是超时错误
      const isTimeoutError = errorMessage.includes('timeout') || errorMessage.includes('超时');
      log(`API请求错误 ${isTimeoutError ? '[超时]' : ''} 第${attempt}次尝试: ${errorMessage}`);
      
      // 退避策略
      const waitTime = backoff * Math.pow(2, i);
      log(`等待${waitTime}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // 所有重试都失败
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  log(`多次尝试后请求失败，放弃: ${errorMessage}`);
  throw lastError || new Error('所有重试尝试都失败了');
};
