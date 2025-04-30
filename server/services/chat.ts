import fetch from "node-fetch";
import { log } from "../vite";
import { storage } from "../storage";
import { webSearchService, type SearchSnippet } from "./web-search";
import { promptManagerService } from "./prompt-manager";
import { conversationAnalyticsService } from "./conversation-analytics";
import { contentModerationService } from "./content-moderation";
import { type Message } from "../../shared/schema";
import fs from "fs";
import path from "path";

// 各模型的上下文窗口大小配置，基于最新官方规格
const MODEL_WINDOW: Record<string, number> = {
  "deepseek": 128000,  // DeepSeek-R1 (NIM)，官方窗口为128k tokens
  "gemini": 1000000,   // gemini-2.5-pro，官方窗口为1M tokens
  "grok": 131072,      // grok-3-fast-beta，官方窗口为128k tokens
  "deep": 1000000      // Dify的窗口大小，设置为最大以适应各种底层模型
};

interface ModelConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  transformRequest?: (
    message: string, 
    contextMemories?: string, 
    searchResults?: string, 
    userId?: number, 
    chatId?: number, 
    contextMessages?: Message[]
  ) => any;
  isSimulated: boolean;
  // 添加此标志以指示是否使用提示词管理服务
  usePromptManager?: boolean;
  // 标记模型是否支持图像输入
  supportsImages?: boolean;
  getResponse: (
    message: string, 
    userId?: number, 
    contextMemories?: string, 
    searchResults?: string, 
    useWebSearch?: boolean,
    chatId?: number,
    contextMessages?: Message[]
  ) => Promise<{ text: string; model: string }>;
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
  private visionModel: string; // 专用图像分析模型
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
    
    // 默认使用Grok模型，因为它支持多模态输入且没有使用量限制
    this.currentModel = "grok";
    this.apiKey = difyApiKey || "";
    
    // 添加专用的图像分析模型配置
    this.visionModel = "grok-2-vision-1212";
    
    this.modelConfigs = {
      // 专用图像分析模型 - 使用Grok-2视觉模型
      "grok-2-vision-1212": {
        endpoint: `https://api.x.ai/v1/chat/completions`,
        headers: {
          "Authorization": `Bearer ${grokApiKey}`,
          "Content-Type": "application/json",
        },
        isSimulated: !grokApiKey,
        usePromptManager: false, // 图像分析不需要提示词管理
        supportsImages: true,
        transformRequest: async (message: string) => {
          // 仅用于图像分析，返回简单配置
          const requestBody: any = {
            model: "grok-2-vision-1212",
            messages: [
              {
                role: "system",
                content: "你是一个专业的图像分析助手。请详细描述图像内容，包括主要对象、场景、文字、色彩和布局等关键元素。"
              },
              {
                role: "user",
                content: message
              }
            ],
            max_tokens: 1500
          };
          return requestBody;
        },
        getResponse: async (message: string) => {
          // 如果没有API密钥，返回模拟响应
          if (!grokApiKey) {
            log(`No Grok-2 Vision API key found, returning simulated response`);
            return {
              text: `[Grok-2-Vision模型-模拟] 这是一个模拟的图像分析响应，因为尚未配置有效的Grok API密钥。当API密钥配置后，此处将显示真实的图像分析结果。`,
              model: "grok-2-vision-1212"
            };
          }
          
          try {
            // 构建转换后的请求
            const transformedMessage = await this.modelConfigs["grok-2-vision-1212"].transformRequest!(message);
            
            log(`调用Grok-2 Vision API进行图像分析`);
            
            const response = await fetchWithRetry(this.modelConfigs["grok-2-vision-1212"].endpoint!, {
              method: "POST",
              headers: this.modelConfigs["grok-2-vision-1212"].headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 30000, // 30秒超时
            }, 3, 1000);

            if (!response.ok) {
              const errorText = await response.text();
              log(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
              throw new Error(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`成功接收Grok-2 Vision API响应`);
            
            // 提取响应文本
            const responseText = data.choices?.[0]?.message?.content || "无法解析图像";
            
            return {
              text: responseText,
              model: "grok-2-vision-1212"
            };
          } catch (error) {
            log(`调用Grok-2 Vision API出错: ${error}`);
            
            return {
              text: `图像分析失败: ${error instanceof Error ? error.message : String(error)}`,
              model: "grok-2-vision-1212"
            };
          }
        }
      },
      gemini: {
        endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent`,
        headers: {
          "Content-Type": "application/json",
        },
        usePromptManager: true, // 启用提示词管理服务
        isSimulated: !geminiApiKey,
        supportsImages: true, // Gemini支持图像输入
        transformRequest: async (
          message: string, 
          contextMemories?: string, 
          searchResults?: string,
          userId?: number,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
          // 获取Gemini的提示词模板（如果有）
          let systemPrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('gemini');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for Gemini model');
              systemPrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              systemPrompt = systemPrompt
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "")
                .replace(/{{current_date}}/g, new Date().toISOString().split('T')[0])
                .replace(/{{current_time}}/g, new Date().toTimeString().split(' ')[0]);
              
              // 处理条件部分
              systemPrompt = systemPrompt.replace(
                /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
                contextMemories ? "$1" : ""
              );
              
              systemPrompt = systemPrompt.replace(
                /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
                searchResults ? "$1" : ""
              );
            }
          } catch (error) {
            log(`Error getting Gemini template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!systemPrompt) {
            systemPrompt = `你是一个先进的AI学习助手，能够提供个性化学习体验。采用KWLQ教学模型，帮助学习者经历知识激活、提出问题、学习应用和拓展反思的阶段。`;
            
            // 添加记忆上下文（如果有）
            if (contextMemories) {
              systemPrompt += `
              
以下是用户的历史学习记忆和对话上下文。请在回答用户当前问题时，自然地融入这些上下文信息，使回答更加连贯和个性化。
不要明确提及"根据你的历史记忆"或"根据你之前提到的"等字眼，而是像熟悉用户的导师一样自然地利用这些信息提供帮助。

为用户构建知识图谱:
${contextMemories}`;
            }
            
            // 添加搜索结果（如果有）
            if (searchResults) {
              systemPrompt += `
              
以下是与用户问题相关的网络搜索结果:
${searchResults}

请根据这些搜索结果为用户提供最新、最准确的信息。`;
            }
          }
          
          // 构建Gemini API请求
          const requestBody: any = {
            contents: [],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 8192, // 增加到8192以支持更长的响应
            }
          };
          
          // 添加系统提示作为第一条消息
          requestBody.contents.push({
            role: "user",
            parts: [{ text: systemPrompt }]
          });
          
          requestBody.contents.push({
            role: "model",
            parts: [{ text: "我理解了。我将作为一个专注于KWLQ教学模型的AI学习助手，根据您的学习记忆和上下文提供个性化的帮助。" }]
          });
          
          // 重要：如果提供了contextMessages，构建完整历史对话
          if (contextMessages && contextMessages.length > 0) {
            log(`Gemini API: 使用完整历史消息，共${contextMessages.length}条`);
            
            // 将上下文消息转换为Gemini格式并添加到contents数组
            for (const msg of contextMessages) {
              // 只添加用户和助手的消息，忽略系统消息
              if (msg.role === 'user') {
                requestBody.contents.push({
                  role: "user",
                  parts: [{ text: msg.content }]
                });
              } else if (msg.role === 'assistant') {
                requestBody.contents.push({
                  role: "model",
                  parts: [{ text: msg.content }]
                });
              }
            }
          }
          
          // 添加当前用户消息 - 检测并处理图片内容
          if (message.includes('![Uploaded Image](') && message.includes(')')) {
            // 解析图片URL
            const imageUrlMatch = message.match(/!\[Uploaded Image\]\(([^)]+)\)/);
            if (imageUrlMatch && imageUrlMatch[1]) {
              const imageUrl = imageUrlMatch[1];
              log(`检测到图片消息，URL: ${imageUrl}`);
              
              try {
                // 获取图片的完整路径
                const imagePath = imageUrl.startsWith('http') 
                  ? imageUrl 
                  : path.join(process.cwd(), imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl);
                
                // 如果是本地文件，读取图片内容
                let imageData;
                if (!imageUrl.startsWith('http')) {
                  // 读取图片文件
                  const imageBuffer = fs.readFileSync(imagePath);
                  // 转换为base64
                  imageData = imageBuffer.toString('base64');
                  
                  // 文本部分 - 提示AI这是用户上传的图片
                  const textPart = { text: "请分析我上传的这张图片:" };
                  
                  // 获取图片的MIME类型
                  let mimeType = "image/jpeg"; // 默认MIME类型
                  // 根据文件扩展名确定MIME类型
                  const ext = path.extname(imagePath).toLowerCase();
                  if (ext === '.png') {
                    mimeType = "image/png";
                  } else if (ext === '.gif') {
                    mimeType = "image/gif";
                  } else if (ext === '.webp') {
                    mimeType = "image/webp";
                  } else if (ext === '.svg') {
                    mimeType = "image/svg+xml";
                  }
                  
                  // 图片部分
                  const imagePart = {
                    inlineData: {
                      mimeType: mimeType,
                      data: imageData
                    }
                  };
                  
                  // 添加多模态内容
                  requestBody.contents.push({
                    role: "user",
                    parts: [textPart, imagePart]
                  });
                  
                  log(`成功添加图片内容到Gemini请求`);
                } else {
                  // 如果是外部URL，直接添加文本消息
                  log(`检测到外部URL图片，仅添加文本引用: ${imageUrl}`);
                  requestBody.contents.push({
                    role: "user",
                    parts: [{ text: message }]
                  });
                }
              } catch (error) {
                log(`处理图片失败: ${error}`);
                // 出错时使用原始文本消息
                requestBody.contents.push({
                  role: "user",
                  parts: [{ text: message }]
                });
              }
            } else {
              // 图片格式无效，使用原始消息
              requestBody.contents.push({
                role: "user",
                parts: [{ text: message }]
              });
            }
          } else {
            // 普通文本消息
            requestBody.contents.push({
              role: "user",
              parts: [{ text: message }]
            });
          }
          
          // 估算token数并在必要时进行裁剪
          const modelMaxTokens = MODEL_WINDOW["gemini"]; // 使用常量配置的Gemini窗口大小
          const estimatedTokens = JSON.stringify(requestBody.contents).length / 4; // 粗略估计
          const reservedTokens = 8192; // 为回复预留空间
          
          if (estimatedTokens > modelMaxTokens - reservedTokens) {
            log(`Gemini API: 消息长度超过限制，进行裁剪。估计tokens: ${estimatedTokens}`);
            
            // 保留系统消息和最近的对话
            const systemMessages = requestBody.contents.slice(0, 2); // 保留系统提示和模型确认
            let userModelExchanges = requestBody.contents.slice(2);
            const currentUserMessage = userModelExchanges.pop(); // 保留当前用户消息
            
            // 从最早的对话开始删除，直到满足限制
            while (JSON.stringify([...systemMessages, ...userModelExchanges, currentUserMessage]).length / 4 > modelMaxTokens - reservedTokens) {
              if (userModelExchanges.length <= 2) {
                // 至少保留最后一轮对话
                break;
              }
              // 删除最早的一对对话（用户和模型回复）
              userModelExchanges.shift();
              if (userModelExchanges.length > 0) {
                userModelExchanges.shift();
              }
            }
            
            // 重建消息数组
            requestBody.contents = [...systemMessages, ...userModelExchanges, currentUserMessage];
            log(`Gemini API: 裁剪后消息数: ${requestBody.contents.length}`);
          }
          
          return requestBody;
        },
        getResponse: async (
          message: string, 
          userId?: number, 
          contextMemories?: string, 
          searchResults?: string, 
          useWebSearch?: boolean,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
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
            // 确保传递完整的上下文消息到transformRequest
            const transformedMessage = await this.modelConfigs.gemini.transformRequest!(
              message, 
              contextMemories, 
              searchResults,
              userId,
              chatId,
              contextMessages
            );
            
            log(`Calling Gemini API with ${transformedMessage.contents.length} messages in context`);
            
            const url = `${this.modelConfigs.gemini.endpoint}?key=${geminiApiKey}`;
            const response = await fetchWithRetry(url, {
              method: "POST",
              headers: this.modelConfigs.gemini.headers!,
              body: JSON.stringify(transformedMessage),
              timeout: 60000, // 增加到60秒超时，因为上下文更大
            }, 3, 1000); // 增加重试间隔

            if (!response.ok) {
              const errorText = await response.text();
              log(`Gemini API error: ${response.status} - ${errorText}`);
              throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data: any = await response.json();
            log(`Received Gemini API response successfully`);
            
            // 提取响应文本
            let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini模型无法生成回应";
            
            // 过滤Gemini模型的<think>标签内容
            const originalLength = responseText.length;
            responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
            if (originalLength !== responseText.length) {
              const reduction = originalLength - responseText.length;
              const percentage = ((reduction / originalLength) * 100).toFixed(1);
              log(`已过滤Gemini思考标签: ${originalLength} -> ${responseText.length} 字符，减少了 ${reduction} 字符 (${percentage}%)`);
            }
            
            return {
              text: responseText,
              model: "gemini"
            };
          } catch (error) {
            log(`Error calling Gemini API: ${error}`);
            
            // 提供更详细的错误信息
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('timeout')) {
              return {
                text: "Gemini API请求超时。这可能是由于消息太长或网络问题导致的。请尝试简化您的问题或稍后再试。",
                model: "gemini"
              };
            } else if (errorMessage.includes('Too many requests')) {
              return {
                text: "Gemini API请求频率超限。请稍后再试或切换到其他模型。",
                model: "gemini"
              };
            }
            
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
        usePromptManager: true, // 启用提示词管理服务
        isSimulated: !deepseekApiKey,
        transformRequest: async (
          message: string, 
          contextMemories?: string, 
          searchResults?: string,
          userId?: number,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
          // 获取DeepSeek的提示词模板（如果有）
          let systemPrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('deepseek');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for DeepSeek model');
              systemPrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              systemPrompt = systemPrompt
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "")
                .replace(/{{current_date}}/g, new Date().toISOString().split('T')[0])
                .replace(/{{current_time}}/g, new Date().toTimeString().split(' ')[0]);
              
              // 处理条件部分
              systemPrompt = systemPrompt.replace(
                /{{#if\s+memory}}([\s\S]*?){{\/if}}/g,
                contextMemories ? "$1" : ""
              );
              
              systemPrompt = systemPrompt.replace(
                /{{#if\s+search}}([\s\S]*?){{\/if}}/g,
                searchResults ? "$1" : ""
              );
            }
          } catch (error) {
            log(`Error getting DeepSeek template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!systemPrompt) {
            systemPrompt = `你是一个先进的AI学习助手DeepSeek，专注于深度分析和详细解释。采用KWLQ教学模型，帮助学习者经历知识激活、提出问题、学习应用和拓展反思的阶段。`;
            
            // 添加记忆上下文（如果有）
            if (contextMemories) {
              systemPrompt += `
              
以下是用户的历史学习记忆和对话上下文:
${contextMemories}

请在回答时自然地融入这些上下文信息，使回答更加深入和个性化。`;
            }
            
            // 添加搜索结果（如果有）
            if (searchResults) {
              systemPrompt += `
              
以下是与用户问题相关的网络搜索结果:
${searchResults}

请根据这些搜索结果为用户提供准确的信息。`;
            }
          }
          
          // 构建DeepSeek/NVIDIA NIM平台的请求体
          // 注意：NVIDIA NIM平台使用OpenAI兼容的接口
          const requestBody: any = {
            model: "deepseek-ai/deepseek-r1",
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 8192, // 增加到8192以支持更长的回答
            messages: []
          };
          
          // 添加系统提示作为第一条消息
          requestBody.messages.push({
            role: "system",
            content: systemPrompt
          });
          
          // 重要：如果提供了contextMessages，构建完整历史对话
          if (contextMessages && contextMessages.length > 0) {
            log(`DeepSeek API: 使用完整历史消息，共${contextMessages.length}条`);
            
            // 将上下文消息转换为OpenAI兼容格式并添加到messages数组
            for (const msg of contextMessages) {
              // 根据角色转换
              if (msg.role === 'user') {
                requestBody.messages.push({
                  role: "user",
                  content: msg.content
                });
              } else if (msg.role === 'assistant') {
                requestBody.messages.push({
                  role: "assistant",
                  content: msg.content
                });
              }
            }
          }
          
          // 添加当前用户消息
          requestBody.messages.push({
            role: "user",
            content: message
          });
          
          // 估算token数并在必要时进行裁剪
          const modelMaxTokens = MODEL_WINDOW["deepseek"]; // 使用常量配置的DeepSeek窗口大小
          const estimatedTokens = JSON.stringify(requestBody.messages).length / 4; // 粗略估计
          const reservedTokens = 8192; // 为回复预留空间
          
          if (estimatedTokens > modelMaxTokens - reservedTokens) {
            log(`DeepSeek API: 消息长度超过限制，进行裁剪。估计tokens: ${estimatedTokens}`);
            
            // 保留系统消息和最近的对话
            const systemMessage = requestBody.messages[0]; // 保留系统消息
            let conversationMessages = requestBody.messages.slice(1);
            const currentUserMessage = conversationMessages.pop(); // 保留当前用户消息
            
            // 从最早的对话开始删除，直到满足限制
            while (JSON.stringify([systemMessage, ...conversationMessages, currentUserMessage]).length / 4 > modelMaxTokens - reservedTokens) {
              if (conversationMessages.length <= 2) {
                // 至少保留最后一轮对话
                break;
              }
              // 删除最早的一对对话
              conversationMessages.shift();
              if (conversationMessages.length > 0) {
                conversationMessages.shift();
              }
            }
            
            // 重建消息数组
            requestBody.messages = [systemMessage, ...conversationMessages, currentUserMessage];
            log(`DeepSeek API: 裁剪后消息数: ${requestBody.messages.length}`);
          }
          
          return requestBody;
        },
        getResponse: async (
          message: string, 
          userId?: number, 
          contextMemories?: string, 
          searchResults?: string, 
          useWebSearch?: boolean,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
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
            
            // 确保传递完整的上下文消息到transformRequest
            const transformedMessage = await this.modelConfigs.deepseek.transformRequest!(
              message, 
              contextMemories, 
              searchResults, 
              userId, 
              chatId, 
              contextMessages
            );
            
            log(`DeepSeek API请求准备完成，包含${transformedMessage.messages.length}条消息`);
            log(`DeepSeek API请求目标: ${this.modelConfigs.deepseek.endpoint!}`);
            
            log(`开始向NVIDIA NIM平台发送DeepSeek API请求...`);
            
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
            
            // 过滤DeepSeek模型的<think>标签内容
            const originalLength = responseText.length;
            responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
            if (originalLength !== responseText.length) {
              const reduction = originalLength - responseText.length;
              const percentage = ((reduction / originalLength) * 100).toFixed(1);
              log(`已过滤DeepSeek思考标签: ${originalLength} -> ${responseText.length} 字符，减少了 ${reduction} 字符 (${percentage}%)`);
            }
            
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
            
            let friendlyMessage = "DeepSeek模型暂时无法使用。";
            if (errorMessage.includes('timeout')) {
              friendlyMessage = "DeepSeek模型请求超时。这可能是由于消息太长或网络问题导致的。请尝试简化您的问题或使用其他模型。";
            } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
              friendlyMessage = "DeepSeek API请求频率超限。请稍后再试或切换到其他模型。";
            } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              friendlyMessage = "DeepSeek API认证失败。请检查API密钥是否正确。";
            } else {
              friendlyMessage = `DeepSeek模型暂时无法使用：连接服务失败。请尝试使用Gemini或Grok模型，或稍后再试。`;
            }
            
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
        usePromptManager: true, // 启用提示词管理服务
        supportsImages: true, // Grok支持图像处理
        transformRequest: async (
          message: string, 
          contextMemories?: string, 
          searchResults?: string,
          userId?: number,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
          // 获取Grok的提示词模板（如果有）
          let systemPrompt = '';
          try {
            const templateRecord = await storage.getPromptTemplate('grok');
            if (templateRecord && (templateRecord.baseTemplate || templateRecord.promptTemplate)) {
              log('Using custom template for Grok model');
              systemPrompt = templateRecord.baseTemplate || templateRecord.promptTemplate || '';
              
              // 执行模板变量替换
              systemPrompt = systemPrompt
                .replace(/{{memory}}/g, contextMemories || "")
                .replace(/{{search}}/g, searchResults || "")
                .replace(/{{current_date}}/g, new Date().toISOString().split('T')[0])
                .replace(/{{current_time}}/g, new Date().toTimeString().split(' ')[0]);
            }
          } catch (error) {
            log(`Error getting Grok template: ${error}`);
          }
          
          // 如果没有自定义提示词模板，使用默认模板
          if (!systemPrompt) {
            systemPrompt = `你是Grok-3，一个先进的AI助手，来自XAI公司，具有幽默感和独特见解。你既是教育者又是学习伙伴，采用KWLQ教学模型，帮助学习者经历知识激活、提出问题、学习应用和拓展反思的阶段。`;
            
            // 添加记忆上下文（如果有）
            if (contextMemories) {
              systemPrompt += `
              
以下是用户的历史学习记忆，请在回答时自然地利用这些信息提供个性化帮助：
${contextMemories}`;
            }
            
            // 添加搜索结果（如果有）
            if (searchResults) {
              systemPrompt += `
              
以下是与当前问题相关的网络搜索结果，请用于提供准确信息：
${searchResults}`;
            }
          }
          
          // 构建xAI的API请求
          const requestBody: any = {
            model: "grok-3-fast-beta",
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 4096, // 增加到4096以支持更长的生成内容
            messages: []
          };
          
          // 添加系统提示作为第一条消息
          requestBody.messages.push({
            role: "system",
            content: systemPrompt
          });
          
          // 重要：如果提供了contextMessages，构建完整历史对话
          if (contextMessages && contextMessages.length > 0) {
            log(`Grok API: 使用完整历史消息，共${contextMessages.length}条`);
            
            // 将上下文消息转换为OpenAI兼容格式并添加到messages数组
            for (const msg of contextMessages) {
              // 根据角色转换
              if (msg.role === 'user') {
                requestBody.messages.push({
                  role: "user",
                  content: msg.content
                });
              } else if (msg.role === 'assistant') {
                requestBody.messages.push({
                  role: "assistant",
                  content: msg.content
                });
              }
            }
          }
          
          // 添加当前用户消息
          requestBody.messages.push({
            role: "user",
            content: message
          });
          
          // 估算token数并在必要时进行裁剪
          const modelMaxTokens = MODEL_WINDOW["grok"]; // 使用常量配置的Grok窗口大小
          const estimatedTokens = JSON.stringify(requestBody.messages).length / 4; // 粗略估计
          const reservedTokens = 4096; // 为回复预留空间
          
          if (estimatedTokens > modelMaxTokens - reservedTokens) {
            log(`Grok API: 消息长度超过限制，进行裁剪。估计tokens: ${estimatedTokens}`);
            
            // 保留系统消息和最近的对话
            const systemMessage = requestBody.messages[0]; // 保留系统消息
            let conversationMessages = requestBody.messages.slice(1);
            const currentUserMessage = conversationMessages.pop(); // 保留当前用户消息
            
            // 从最早的对话开始删除，直到满足限制
            while (JSON.stringify([systemMessage, ...conversationMessages, currentUserMessage]).length / 4 > modelMaxTokens - reservedTokens) {
              if (conversationMessages.length <= 2) {
                // 至少保留最后一轮对话
                break;
              }
              // 删除最早的一对对话
              conversationMessages.shift();
              if (conversationMessages.length > 0) {
                conversationMessages.shift();
              }
            }
            
            // 重建消息数组
            requestBody.messages = [systemMessage, ...conversationMessages, currentUserMessage];
            log(`Grok API: 裁剪后消息数: ${requestBody.messages.length}`);
          }
          
          return requestBody;
        },
        getResponse: async (
          message: string, 
          userId?: number, 
          contextMemories?: string, 
          searchResults?: string, 
          useWebSearch?: boolean,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
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
            // 确保传递完整的上下文消息到transformRequest
            const transformedMessage = await this.modelConfigs.grok.transformRequest!(
              message, 
              contextMemories, 
              searchResults,
              userId,
              chatId,
              contextMessages
            );
            
            log(`Calling Grok API with ${transformedMessage.messages.length} messages in context`);
            
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
            log(`Received Grok API response successfully`);
            
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
            
            let friendlyMessage = "Grok模型暂时无法使用。";
            if (errorMessage.includes('timeout')) {
              friendlyMessage = "Grok模型请求超时。这可能是由于消息太长或网络问题导致的。请尝试简化您的问题或使用其他模型。";
            } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
              friendlyMessage = "Grok API请求频率超限。请稍后再试或切换到其他模型。";
            } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
              friendlyMessage = "Grok API认证失败。请检查API密钥是否正确。";
            } else {
              friendlyMessage = `Grok模型暂时无法使用：连接服务失败。请尝试使用Gemini或DeepSeek模型，或稍后再试。`;
            }
            
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
        usePromptManager: false, // Deep 直接连接到 Dify 工作流，不需要提示词管理
        supportsImages: false, // Dify API是否支持图片输入取决于后台配置，默认不支持
        transformRequest: async (
          message: string, 
          contextMemories?: string, 
          searchResults?: string,
          userId?: number,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
          // Deep模型是一个工作流，直接发送用户查询而不需要复杂的提示词模板
          const userQuestion = message.trim();
          
          // 从存储中获取当前会话的Dify conversation_id（如果存在）
          let difyConversationId = null;
          if (chatId) {
            try {
              const chatInfo = await storage.getChat(chatId);
              if (chatInfo && chatInfo.metadata) {
                const metadata = chatInfo.metadata as Record<string, any>;
                if (metadata.dify_conversation_id) {
                  difyConversationId = metadata.dify_conversation_id;
                  log(`找到已有的Dify会话ID: ${difyConversationId}`);
                }
              }
            } catch (error) {
              log(`无法获取Dify会话ID: ${error}`);
            }
          }
          
          // 构建Dify API请求格式 - 简化版
          // 尝试最简单的请求结构，减少可能的错误
          const requestPayload: any = {
            query: userQuestion,     // 用户原始问题
            response_mode: "blocking"
          };
          
          // 如果有会话ID，添加到请求中
          if (difyConversationId) {
            requestPayload.conversation_id = difyConversationId;
          }
          
          // 添加基本的用户标识
          requestPayload.user = userId ? `user-${userId}` : "user";
          
          // 不添加任何可选的inputs数据，测试最小化请求
          
          // 注意：由于Dify是有状态API，我们不需要传递完整的历史消息
          // Dify会自动基于conversation_id维护对话上下文
          
          // 记录请求详情
          log(`Dify请求: ${difyConversationId ? '使用现有会话' : '新建会话'}, 有效载荷大小: ${JSON.stringify(requestPayload).length}字节`);
          return requestPayload;
        },
        getResponse: async (
          message: string, 
          userId?: number, 
          contextMemories?: string, 
          searchResults?: string, 
          useWebSearch?: boolean,
          chatId?: number,
          contextMessages?: Message[]
        ) => {
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
            const transformedMessage = await this.modelConfigs.deep.transformRequest!(
              message, 
              contextMemories, 
              searchResults,
              userId,
              chatId,
              contextMessages
            );
            
            // 记录API密钥前几个字符（安全日志）
            const apiKeyPrefix = difyApiKey.substring(0, 4) + '...' + difyApiKey.substring(difyApiKey.length - 4);
            log(`调用Dify API，使用密钥: ${apiKeyPrefix}，消息长度: ${JSON.stringify(transformedMessage).length}字节`);
            
            const headers = {
              "Authorization": `Bearer ${difyApiKey}`,
              "Content-Type": "application/json",
            };
            
            // 优化重试策略：减少重试次数并增加间隔，避免频繁重复请求
            const response = await fetchWithRetry(this.modelConfigs.deep.endpoint!, {
              method: "POST",
              headers: headers,
              body: JSON.stringify(transformedMessage),
              timeout: 60000, // 保持60秒超时
            }, 2, 5000); // 减少到2次重试，增加初始间隔到5秒

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
            
            // 获取响应文本
            let responseText = data.answer || "Dify模型暂时无法回应";
            
            // 重要：保存Dify返回的conversation_id
            if (data.conversation_id && chatId) {
              // 记录日志
              log(`Dify返回了对话ID: ${data.conversation_id}，将存储到聊天${chatId}的元数据中`);
              
              // 尝试将conversation_id保存到聊天元数据中
              try {
                await storage.updateChatMetadata(chatId, {
                  dify_conversation_id: data.conversation_id
                });
                log(`已更新聊天${chatId}的Dify会话ID`);
              } catch (error) {
                log(`无法更新聊天元数据: ${error}`);
              }
            }
            
            // 过滤Dify模型的<think>标签内容
            const originalLength = responseText.length;
            responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '');
            if (originalLength !== responseText.length) {
              const reduction = originalLength - responseText.length;
              const percentage = ((reduction / originalLength) * 100).toFixed(1);
              log(`已过滤Dify思考标签: ${originalLength} -> ${responseText.length} 字符，减少了 ${reduction} 字符 (${percentage}%)`);
            }
            
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
   * 智能动态上下文截断
   * 根据模型的最大上下文窗口大小，智能截断消息历史
   * 优先保留系统提示和最近对话，裁剪中间历史
   * @param messages 消息历史
   * @param model 模型名称
   * @returns 截断后的消息历史
   */
  trimContext(messages: Message[], model: string): Message[] {
    // 获取模型的窗口大小，如果不存在则使用安全默认值
    const modelMaxTokens = model in MODEL_WINDOW ? MODEL_WINDOW[model] : 16384; // 默认使用较小的16K窗口
    const bufferTokens = 8192; // 为响应保留的缓冲区大小，增大以确保有足够空间
    const maxTokens = modelMaxTokens - bufferTokens;
    
    // 简单估算当前消息的token数
    // 这是一个粗略估计，平均4个字符≈1个token
    function estimateTokens(msg: Message): number {
      if (!msg.content) return 0;
      return Math.ceil(msg.content.length / 4);
    }
    
    // 计算所有消息的估计token数
    let totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
    log(`模型${model}上下文窗口大小: ${modelMaxTokens}，当前估计token数: ${totalTokens}，最大允许: ${maxTokens}`);
    
    // 如果没有超出限制，直接返回原始消息
    if (totalTokens <= maxTokens) {
      return messages;
    }
    
    // 将消息分类为系统消息、最近对话和中间历史
    const systemMessages: Message[] = messages.filter(m => m.role === 'system');
    const nonSystemMessages: Message[] = messages.filter(m => m.role !== 'system');
    
    // 计算系统消息的token数
    const systemTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
    log(`系统消息占用token数: ${systemTokens}，共${systemMessages.length}条`);
    
    // 确保保留最后几轮对话（至少2-3轮）
    const recentExchangeCount = Math.min(6, Math.floor(nonSystemMessages.length / 2) * 2);
    const recentMessages = nonSystemMessages.slice(-recentExchangeCount);
    const middleMessages = nonSystemMessages.slice(0, -recentExchangeCount);
    
    // 计算最近对话的token数
    const recentTokens = recentMessages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
    log(`最近${recentExchangeCount}条消息占用token数: ${recentTokens}`);
    
    // 计算系统消息和最近对话的总token数
    const essentialTokens = systemTokens + recentTokens;
    
    // 如果系统消息和最近对话已经超出限制，则只能保留系统消息和最重要的最近对话
    if (essentialTokens > maxTokens) {
      log(`警告: 系统消息和最近对话已超出token限制(${essentialTokens} > ${maxTokens})`, 'warn');
      
      // 保留所有系统消息，尽可能多地保留最近对话
      const availableTokensForRecent = Math.max(0, maxTokens - systemTokens);
      let keepRecentMessages: Message[] = [];
      let recentTokenCount = 0;
      
      // 从最近的消息开始添加，直到达到可用token限制
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msgTokens = estimateTokens(recentMessages[i]);
        if (recentTokenCount + msgTokens <= availableTokensForRecent) {
          keepRecentMessages.unshift(recentMessages[i]);
          recentTokenCount += msgTokens;
        } else {
          break;
        }
      }
      
      log(`紧急裁剪后保留系统消息${systemMessages.length}条和最近消息${keepRecentMessages.length}条，总token数约${systemTokens + recentTokenCount}`);
      return [...systemMessages, ...keepRecentMessages];
    }
    
    // 计算中间历史可用的token数
    const availableTokensForMiddle = maxTokens - essentialTokens;
    log(`中间历史可用token数: ${availableTokensForMiddle}，共${middleMessages.length}条消息`);
    
    // 如果没有足够空间放任何中间历史，直接返回系统消息和最近对话
    if (availableTokensForMiddle <= 0 || middleMessages.length === 0) {
      log(`没有足够空间放置中间历史，仅保留系统消息和最近对话`);
      return [...systemMessages, ...recentMessages];
    }
    
    // 从中间历史中选择性保留消息
    let keepMiddleMessages: Message[] = [];
    let middleTokenCount = 0;
    
    // 优先保留最近的中间历史
    for (let i = middleMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(middleMessages[i]);
      if (middleTokenCount + msgTokens <= availableTokensForMiddle) {
        keepMiddleMessages.unshift(middleMessages[i]);
        middleTokenCount += msgTokens;
      } else {
        // 如果这是一个用户消息，检查是否有足够空间保留一个简短摘要
        if (middleMessages[i].role === 'user' && middleMessages[i].content && middleMessages[i].content.length > 100) {
          // 创建一个简短摘要版本
          const truncatedContent = middleMessages[i].content.substring(0, 50) + "...[已裁剪]";
          const truncatedMsg = { ...middleMessages[i], content: truncatedContent };
          const truncatedTokens = estimateTokens(truncatedMsg);
          
          if (middleTokenCount + truncatedTokens <= availableTokensForMiddle) {
            keepMiddleMessages.unshift(truncatedMsg);
            middleTokenCount += truncatedTokens;
            log(`已裁剪一条消息内容至简短摘要`);
          }
        }
        // 否则跳过此消息
      }
    }
    
    // 构建最终消息数组：系统消息 + 保留的中间历史 + 最近对话
    const finalMessages = [...systemMessages, ...keepMiddleMessages, ...recentMessages];
    const finalTokenCount = systemTokens + middleTokenCount + recentTokens;
    
    log(`智能裁剪后保留${finalMessages.length}条消息，总token数约${finalTokenCount}，其中系统消息${systemMessages.length}条，中间历史${keepMiddleMessages.length}条，最近对话${recentMessages.length}条`);
    
    return finalMessages;
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

  async sendMessage(
    message: string, 
    userId?: number, 
    chatId?: number, 
    useWebSearch?: boolean,
    contextMessages?: Message[] // 上下文消息历史
  ) {
    try {
      // 如果提供了参数，则更新搜索设置
      if (useWebSearch !== undefined) {
        this.setWebSearchEnabled(useWebSearch);
      }
      
      // 检测是否包含图片，需要预处理
      const containsImage = message.includes('![Uploaded Image](') && message.includes(')');
      let processedMessage = message;
      let imageProcessingNotice = "";
      
      // 如果消息包含图片，使用Grok-2 Vision模型进行预处理
      if (containsImage) {
        try {
          log(`检测到图片内容，使用Grok-2 Vision模型进行预处理...`);
          
          // 调用Grok-2 Vision模型分析图片
          // 全新重写的图像处理逻辑，直接调用processImageWithGrokVision方法
          const imageAnalysisResponse = await this.processImageWithGrokVision(message);
          
          // 将图片分析结果添加到消息中
          const imageAnalysis = imageAnalysisResponse.text;
          
          // 记录详细日志，便于调试
          log(`图片分析结果: ${imageAnalysis.substring(0, 100)}...`);
          
          // 将原始消息中的图片标记替换为文本描述
          processedMessage = message.replace(
            /!\[Uploaded Image\]\([^)]+\)/g, 
            '[图片内容已由AI分析]'
          );
          
          // 在消息前添加图片分析结果 - 使用更清晰的格式
          processedMessage = `[图片分析结果]:\n${imageAnalysis}\n\n[用户原始消息]:\n${processedMessage}`;
          
          // 添加处理通知
          imageProcessingNotice = "⚠️ 图片已由Grok-2 Vision模型预处理并转换为文本描述";
          log(`图片已成功分析并转换为文本描述`);
        } catch (error) {
          log(`图片预处理失败: ${error}`);
          imageProcessingNotice = "⚠️ 图片分析失败，将尝试直接处理";
        }
      }
      
      log(`处理消息，使用${this.currentModel}模型: ${processedMessage.substring(0, 50)}..., 网络搜索: ${this.useWebSearch}, 上下文消息: ${contextMessages ? `${contextMessages.length}条` : '无'}`);
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
      
      // 如果没有提供上下文消息但有chatId和userId，则从数据库获取
      if (!contextMessages && chatId && userId) {
        try {
          contextMessages = await storage.getChatMessages(chatId, userId, false);
          log(`从数据库获取到${contextMessages.length}条聊天历史消息`);
        } catch (error) {
          log(`获取聊天历史失败: ${error}`);
        }
      }
      
      // 如果有上下文消息，添加当前用户消息（用于对话阶段分析）
      let messagesWithCurrent: Message[] = [];
      if (contextMessages && contextMessages.length > 0) {
        const currentMessage: Message = {
          content: message,
          role: "user", 
          chatId: chatId || 0,
          id: 0, 
          createdAt: new Date(),
          model: null,
          feedback: null,
          feedbackText: null,
          isEdited: null,
          isActive: true
        };
        
        messagesWithCurrent = [...contextMessages, currentMessage];
        
        // 使用动态上下文截断功能，根据当前模型的窗口大小裁剪消息历史
        messagesWithCurrent = this.trimContext(messagesWithCurrent, this.currentModel);
        log(`应用动态上下文截断后，保留${messagesWithCurrent.length}条消息`);
        
        // 如果有chatId，分析对话阶段
        if (chatId) {
          try {
            await conversationAnalyticsService.analyzeConversationPhase(chatId, messagesWithCurrent);
          } catch (error) {
            log(`对话阶段分析失败: ${error}`);
          }
        }
      }
      
      // 确定如何处理提示词
      let finalProcessedMessage = processedMessage;
      
      // 判断是否使用提示词管理服务
      if (config.usePromptManager) {
        try {
          // 使用提示词管理服务获取动态提示词
          finalProcessedMessage = await promptManagerService.getDynamicPrompt(
            this.currentModel,
            chatId || 0, // 如果没有chatId，使用0作为默认值
            message,
            contextMemories,
            searchResults
          );
          log(`使用增强版模块化提示词处理消息，模型: ${this.currentModel}`);
        } catch (error) {
          log(`提示词管理服务处理失败，回退到基本提示词: ${error}`);
          // 出错时继续使用原始消息
        }
      } else {
        // 尝试获取模型的提示词模板
        const promptTemplate = await this.getModelPromptTemplate(this.currentModel);
        
        // 如果有提示词模板，应用模板
        if (promptTemplate) {
          finalProcessedMessage = this.applyPromptTemplate(
            promptTemplate,
            message,
            contextMemories,
            searchResults
          );
          log(`使用传统提示词模板处理消息，模型: ${this.currentModel}`);
        }
      }
      
      // 关键改进：传递contextMessages给模型的getResponse函数
      const response = await config.getResponse(
        finalProcessedMessage, 
        userId, 
        contextMemories, 
        searchResults, 
        this.useWebSearch,
        chatId,
        messagesWithCurrent.length > 0 ? messagesWithCurrent : contextMessages
      );
      
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
  
  // 处理图片分析 - 使用Grok Vision API
  /**
   * 上传文件到Grok API并获取文件ID
   * 使用Grok的专用files.create API上传图片以便在聊天中使用
   * @param imageBuffer 图片的Buffer数据
   * @param mimeType 图片的MIME类型
   * @returns 上传后的file_id
   */
  async uploadFileToGrok(imageBuffer: Buffer, mimeType: string): Promise<string> {
    // 检查Grok API密钥是否配置
    const grokApiKey = process.env.GROK_API_KEY;
    
    if (!grokApiKey) {
      log(`No Grok API key found for file upload`);
      throw new Error("未配置Grok API密钥，无法上传文件");
    }
    
    try {
      // 将图片buffer转换为base64
      const base64Data = imageBuffer.toString('base64');
      
      // 调用Grok files.create API创建文件
      log(`调用Grok files.create API上传图片，大小: ${(base64Data.length / 1024).toFixed(2)}KB`);
      
      const response = await fetchWithRetry(`https://api.x.ai/v1/files`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${grokApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: base64Data,
          purpose: "vision",  // 关键参数：指定purpose为vision
          mime_type: mimeType
        }),
        timeout: 30000, // 30秒超时
      }, 3, 1000);
      
      if (!response.ok) {
        const errorText = await response.text();
        log(`Grok文件上传错误: ${response.status} - ${errorText}`);
        throw new Error(`Grok文件上传错误: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      log(`成功上传文件到Grok API，获取文件ID: ${data.id}`);
      
      return data.id; // 返回文件ID
    } catch (error) {
      log(`上传文件到Grok失败: ${error}`);
      throw error;
    }
  }

  async processImageWithGrokVision(message: string): Promise<{ text: string; model: string }> {
    // 检查Grok API密钥是否配置
    const grokApiKey = process.env.GROK_API_KEY;
    
    // 如果没有API密钥，返回模拟响应
    if (!grokApiKey) {
      log(`No Grok-2 Vision API key found, returning simulated response`);
      return {
        text: `[Grok-2-Vision模型-模拟] 这是一个模拟的图像分析响应，因为尚未配置有效的Grok API密钥。当API密钥配置后，此处将显示真实的图像分析结果。`,
        model: "grok-2-vision-1212"
      };
    }
    
    try {
      // 检查消息是否包含图像链接
      if (message.includes('![') && message.includes(')')) {
        log(`检测到图片消息：${message}`);
        
        // 解析图片URL
        const imageUrlMatch = message.match(/!\[(.*?)\]\(([^)]+)\)/);
        if (imageUrlMatch && imageUrlMatch[2]) {
          const imageUrl = imageUrlMatch[2];
          log(`提取到图片URL: ${imageUrl}`);
          
          if (imageUrl.startsWith('/uploads/')) {
            // 获取本地文件
            const imagePath = path.join(process.cwd(), imageUrl);
            log(`图片本地路径: ${imagePath}`);
            
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              
              // 获取MIME类型
              let mimeType = "image/jpeg"; // 默认MIME类型
              const ext = path.extname(imagePath).toLowerCase();
              if (ext === '.png') {
                mimeType = "image/png";
              } else if (ext === '.gif') {
                mimeType = "image/gif";
              } else if (ext === '.webp') {
                mimeType = "image/webp";
              } else if (ext === '.svg') {
                mimeType = "image/svg+xml";
              }
              
              // 上传文件到Grok获取文件ID
              const fileId = await this.uploadFileToGrok(imageBuffer, mimeType);
              
              // 使用文件ID构建图像消息内容
              const visionMessage = {
                type: "image_file",
                image_file: {
                  file_id: fileId
                }
              };
              
              // 构建带有图像的请求
              const requestBody = {
                model: "grok-2-vision-1212",
                messages: [
                  {
                    role: "system",
                    content: "你是一个专业的图像分析助手。请详细描述图像内容，包括主要对象、场景、文字、色彩和布局等关键元素。"
                  },
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "请分析这张图片的内容："
                      },
                      visionMessage
                    ]
                  }
                ],
                max_tokens: 1500
              };
              
              log(`调用Grok-2 Vision API进行图像分析，使用文件ID: ${fileId}`);
              
              // 发送请求到Grok-2 Vision API
              const response = await fetchWithRetry(`https://api.x.ai/v1/chat/completions`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${grokApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                timeout: 30000, // 30秒超时
              }, 3, 1000);
              
              if (!response.ok) {
                const errorText = await response.text();
                log(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
                throw new Error(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
              }
              
              const data = await response.json();
              log(`成功接收Grok-2 Vision API响应`);
              
              return {
                text: data.choices[0].message.content,
                model: "grok-2-vision-1212"
              };
            } else {
              throw new Error(`图片文件不存在: ${imagePath}`);
            }
          } else {
            throw new Error(`不支持的图片URL格式: ${imageUrl}`);
          }
        }
      }

      // 如果不含图片或图片处理失败，使用普通文本请求处理
      const requestBody = {
        model: "grok-2-vision-1212",
        messages: [
          {
            role: "system",
            content: "你是一个专业的图像分析助手。请详细描述图像内容，包括主要对象、场景、文字、色彩和布局等关键元素。"
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 1500
      };
      
      log(`调用Grok-2 Vision API进行文本处理`);
      
      // 使用自定义的fetchWithRetry函数处理请求
      const response = await fetchWithRetry(`https://api.x.ai/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${grokApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        timeout: 30000, // 30秒超时
      }, 3, 1000);

      if (!response.ok) {
        const errorText = await response.text();
        log(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
        throw new Error(`Grok-2 Vision API错误: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      log(`成功接收Grok-2 Vision API响应`);
      
      // 提取响应文本
      const responseText = data.choices?.[0]?.message?.content || "无法解析图像";
      
      // 添加说明，标明这是由Grok-2 Vision处理的结果
      const formattedResponse = `⚠️ 图片已由Grok-2 Vision模型预处理并转换为文本描述：\n\n${responseText}`;
      
      return {
        text: formattedResponse,
        model: "grok-2-vision-1212"
      };
    } catch (error) {
      log(`调用Grok-2 Vision API出错: ${error}`);
      
      return {
        text: `图像分析失败: ${error instanceof Error ? error.message : String(error)}`,
        model: "grok-2-vision-1212"
      };
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
