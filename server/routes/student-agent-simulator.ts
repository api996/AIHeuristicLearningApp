import { Router, Request, Response } from 'express';
import { log } from '../vite';
import { storage } from '../storage';
import { studentAgentService } from '../services/student-agent';
import { MemoryService } from '../services/learning/memory_service';
import { requireAdmin } from '../middleware/auth';
import { fetchWithRetry } from '../services/utils';

// 获取Grok API密钥
let grokApiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY; // 支持两种环境变量名

// 检查并清理API密钥格式 
if (grokApiKey) {
  // 主服务可以正常使用API密钥，所以我们保持相同格式即可
  // 只需要确保移除可能错误附加的"Bearer "前缀
  if (grokApiKey.includes('Bearer ')) {
    grokApiKey = grokApiKey.replace('Bearer ', '');
    log(`[StudentAgentSimulator] 已移除API密钥中的Bearer前缀`);
  }
  
  log(`[StudentAgentSimulator] API密钥已验证，长度: ${grokApiKey.length}字符`);
}

// 如果没有API密钥，使用模拟响应
const hasValidApiKey = !!grokApiKey;

// 学生智能体模拟器路由
const router = Router();

// 用于存储活动模拟会话的Map
// 在实际生产环境中，这些应该存储在数据库中并通过WebSocket更新
const activeSimulations = new Map<number, {
  sessionId: number;
  presetId: number;
  userId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  currentState: any;
  startTime: Date;
  endTime?: Date;
  interval?: NodeJS.Timeout;
  model: string; // 使用的模型
  waitingForResponse: boolean; // 是否正在等待模型响应
  lastResponseTime?: Date; // 上次收到响应的时间
  rateLimitCounter: number; // 速率限制计数器
  rateLimitResetTime?: Date; // 速率限制重置时间
  chatId?: number; // 实际的聊天ID
}>();

// 模型配置类型定义
interface ModelConfig {
  name: string;
  maxMessagesPerMinute: number;
  maxMessagesPerHour: number;
  responseTimeRange: [number, number]; // [min, max] 毫秒
  readingSpeed: number;
  typingSpeed: number;
}

// 可用模型及其对应的配置
const MODELS: Record<string, ModelConfig> = {
  'gemini': {
    name: 'Gemini 2.5 Pro',
    maxMessagesPerMinute: 15,
    maxMessagesPerHour: 60,
    responseTimeRange: [2000, 8000], // 毫秒，模拟响应时间
    readingSpeed: 10, // 字符/秒，模拟阅读用户消息的速度
    typingSpeed: 5 // 字符/秒，模拟输入响应的速度
  },
  'deepseek': {
    name: 'DeepSeek R1',
    maxMessagesPerMinute: 12,
    maxMessagesPerHour: 50,
    responseTimeRange: [3000, 10000],
    readingSpeed: 12,
    typingSpeed: 4
  },
  'grok': {
    name: 'Grok 3 Fast Beta',
    maxMessagesPerMinute: 20,
    maxMessagesPerHour: 80,
    responseTimeRange: [1000, 5000],
    readingSpeed: 8,
    typingSpeed: 6
  }
};

// 初始化记忆服务
const memoryService = new MemoryService();

// 启动模拟会话
router.post('/simulate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { presetId, userId, maxMessages = 10, initialPrompt = "你好，我想学习一些新知识。" } = req.body;
    
    if (!presetId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: "缺少必要参数: presetId, userId" 
      });
    }

    // 验证用户存在
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "指定的用户不存在" 
      });
    }

    // 验证预设存在
    const preset = await storage.getStudentAgentPreset(presetId);
    if (!preset) {
      return res.status(404).json({ 
        success: false, 
        message: "指定的预设不存在" 
      });
    }

    // 创建学生智能体会话
    const session = await storage.createStudentAgentSession(
      userId,
      presetId,
      preset.subject || "通用学习", // 使用预设的学科作为学习主题
      `${preset.name}-模拟会话`
    );

    // 记录模拟会话
    const simulationId = session.id;
    
    // 始终使用Grok模型，因为它更适合模拟学生行为
    // const modelKeys = Object.keys(MODELS);
    // const randomModel = modelKeys[Math.floor(Math.random() * modelKeys.length)];
    const randomModel = 'grok'; // 强制使用Grok模型

    // 添加到活动模拟会话Map
    activeSimulations.set(simulationId, {
      sessionId: simulationId,
      presetId,
      userId,
      status: 'pending',
      messages: [],
      currentState: session.currentState || {}, // 使用currentState属性
      startTime: new Date(),
      model: randomModel,
      waitingForResponse: false,
      rateLimitCounter: 0,
      rateLimitResetTime: new Date(Date.now() + 60000), // 一分钟后重置
    });
    
    log(`[StudentAgentSimulator] 已创建模拟会话: ${simulationId}, 用户: ${user.username}, 预设: ${preset.name}`);

    // 启动模拟
    startSimulation(simulationId, initialPrompt, maxMessages);
    
    // 响应成功
    res.status(201).json({
      success: true,
      sessionId: simulationId,
      userId: userId,
      username: user.username,
      presetId: presetId,
      presetName: preset.name,
      maxMessages: maxMessages
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[StudentAgentSimulator] 创建模拟会话失败: ${errorMessage}`);
    res.status(500).json({ 
      success: false, 
      message: `创建模拟会话失败: ${errorMessage}` 
    });
  }
});

// 获取模拟会话状态
router.get('/simulate/:id', requireAdmin, (req: Request, res: Response) => {
  try {
    const simulationId = parseInt(req.params.id);
    
    if (isNaN(simulationId)) {
      return res.status(400).json({ 
        success: false, 
        message: "无效的模拟会话ID" 
      });
    }
    
    const simulation = activeSimulations.get(simulationId);
    
    if (!simulation) {
      return res.status(404).json({ 
        success: false, 
        message: "模拟会话不存在或已结束" 
      });
    }
    
    // 返回会话状态，不包括interval属性
    const { interval, ...simulationData } = simulation;
    
    res.json({
      success: true,
      simulation: simulationData
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    res.status(500).json({ 
      success: false, 
      message: `获取模拟会话状态失败: ${errorMessage}` 
    });
  }
});

// 停止模拟会话
router.post('/simulate/:id/stop', requireAdmin, (req: Request, res: Response) => {
  try {
    const simulationId = parseInt(req.params.id);
    
    if (isNaN(simulationId)) {
      return res.status(400).json({ 
        success: false, 
        message: "无效的模拟会话ID" 
      });
    }
    
    const simulation = activeSimulations.get(simulationId);
    
    if (!simulation) {
      return res.status(404).json({ 
        success: false, 
        message: "模拟会话不存在或已结束" 
      });
    }
    
    // 停止模拟
    stopSimulation(simulationId);
    
    res.json({
      success: true,
      message: "模拟会话已停止",
      sessionId: simulationId
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    res.status(500).json({ 
      success: false, 
      message: `停止模拟会话失败: ${errorMessage}` 
    });
  }
});

// 获取所有活动模拟会话
router.get('/simulate', requireAdmin, (_req: Request, res: Response) => {
  try {
    const simulations = Array.from(activeSimulations.entries()).map(([id, simulation]) => {
      const { interval, ...simulationData } = simulation;
      return {
        id,
        ...simulationData
      };
    });
    
    res.json({
      success: true,
      simulations
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    res.status(500).json({ 
      success: false, 
      message: `获取模拟会话列表失败: ${errorMessage}` 
    });
  }
});

// 启动模拟会话
async function startSimulation(simulationId: number, initialPrompt: string, maxMessages: number) {
  try {
    const simulation = activeSimulations.get(simulationId);
    if (!simulation) return;
    
    // 更新状态为运行中
    simulation.status = 'running';
    
    // 模拟创建真实聊天会话
    try {
      // 记录用户消息
      simulation.messages.push({ role: 'user', content: initialPrompt });
      
      // 更新状态为等待响应
      simulation.waitingForResponse = true;
      
      // 模拟API调用并检查速率限制
      await simulateApiResponse(simulationId, initialPrompt);
      
      // 开始定时检查和发送消息
      startMessagePolling(simulationId, maxMessages);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log(`[StudentAgentSimulator] 会话 ${simulationId} 初始消息发送失败: ${errorMessage}`);
      
      if (activeSimulations.has(simulationId)) {
        activeSimulations.get(simulationId)!.status = 'failed';
      }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[StudentAgentSimulator] 启动模拟会话 ${simulationId} 失败: ${errorMessage}`);
    
    if (activeSimulations.has(simulationId)) {
      activeSimulations.get(simulationId)!.status = 'failed';
    }
  }
}

// 开始消息轮询
function startMessagePolling(simulationId: number, maxMessages: number) {
  const simulation = activeSimulations.get(simulationId);
  if (!simulation) return;
  
  // 检查状态的定时器 (每2秒检查一次)
  simulation.interval = setInterval(async () => {
    try {
      // 如果已达到最大消息数或状态不再是'running'，则停止模拟
      if (simulation.messages.length >= maxMessages * 2 || simulation.status !== 'running') {
        stopSimulation(simulationId);
        return;
      }
      
      // 如果正在等待响应，则不发送新消息
      if (simulation.waitingForResponse) {
        return;
      }
      
      // 检查速率限制
      const now = new Date();
      
      // 如果有速率限制重置时间且尚未到达，则不发送新消息
      if (simulation.rateLimitResetTime && now < simulation.rateLimitResetTime) {
        const waitTimeMs = simulation.rateLimitResetTime.getTime() - now.getTime();
        log(`[StudentAgentSimulator] 会话 ${simulationId} 等待速率限制重置，剩余 ${Math.ceil(waitTimeMs / 1000)} 秒`);
        return;
      }
      
      // 重置计数器(如果需要)
      if (simulation.rateLimitResetTime && now >= simulation.rateLimitResetTime) {
        simulation.rateLimitCounter = 0;
        simulation.rateLimitResetTime = new Date(now.getTime() + 60000); // 设置下一个重置时间
      }
      
      // 获取模型配置
      const modelConfig = MODELS[simulation.model];
      
      // 检查是否达到每分钟最大消息数量限制
      if (simulation.rateLimitCounter >= modelConfig.maxMessagesPerMinute) {
        // 设置下一个重置时间
        simulation.rateLimitResetTime = new Date(now.getTime() + 60000);
        simulation.rateLimitCounter = 0;
        log(`[StudentAgentSimulator] 会话 ${simulationId} 达到速率限制，等待 60 秒后继续`);
        return;
      }
      
      // 增加消息计数
      simulation.rateLimitCounter++;
      
      // 根据学生智能体的状态，自动生成后续问题
      const nextPrompt = await generateNextQuestion(simulation.currentState);
      
      // 记录用户消息
      simulation.messages.push({ role: 'user', content: nextPrompt });
      
      // 设置等待响应状态
      simulation.waitingForResponse = true;
      
      // 模拟API调用和响应
      simulateApiResponse(simulationId, nextPrompt).catch(error => {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        log(`[StudentAgentSimulator] 会话 ${simulationId} 发送消息失败: ${errorMessage}`);
        
        // 恢复非等待状态
        if (activeSimulations.has(simulationId)) {
          const sim = activeSimulations.get(simulationId)!;
          sim.waitingForResponse = false;
        }
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log(`[StudentAgentSimulator] 会话 ${simulationId} 消息处理错误: ${errorMessage}`);
    }
  }, 2000); // 每2秒检查一次状态
}

// 模拟API响应，包括真实的延迟和模型特定的响应特性
async function simulateApiResponse(simulationId: number, prompt: string): Promise<void> {
  const simulation = activeSimulations.get(simulationId);
  if (!simulation) throw new Error("无效的模拟会话ID");
  
  const modelConfig = MODELS[simulation.model];
  
  try {
    // 模拟模型阅读提示的时间 (阅读速度 * 字符数)
    const readingTimeMs = (prompt.length / modelConfig.readingSpeed) * 1000;
    
    // 生成随机响应时间
    const responseTimeMs = getRandomInterval(
      modelConfig.responseTimeRange[0], 
      modelConfig.responseTimeRange[1]
    );
    
    // 总处理时间 = 阅读时间 + 响应时间
    const totalDelayMs = Math.min(readingTimeMs + responseTimeMs, 15000); // 最多15秒
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, totalDelayMs));
    
    // 调用学生智能体服务，模拟真实用户请求
    // 这里可以接入真实的服务，或者使用模拟的响应
    // 为了简单起见，我们为每种模型生成不同风格的简单响应
    const response = await generateModelResponse(simulation.model, prompt, simulation.currentState);
    
    // 记录助手响应消息
    simulation.messages.push({ role: 'assistant', content: response.text });
    
    // 更新当前状态
    simulation.currentState = response.updatedState || simulation.currentState;
    
    // 更新最后响应时间
    simulation.lastResponseTime = new Date();
    
    // 重置等待状态
    simulation.waitingForResponse = false;
    
    // 创建记忆
    await createMemoryFromConversation(
      simulation.userId, 
      prompt,
      response.text,
      simulation.currentState
    );
    
    // 添加日志
    log(`[StudentAgentSimulator] 会话 ${simulationId} 收到来自 ${modelConfig.name} 的响应`);
    
  } catch (error) {
    // 处理错误
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    log(`[StudentAgentSimulator] 会话 ${simulationId} API响应错误: ${errorMessage}`);
    
    // 错误后重置等待状态
    simulation.waitingForResponse = false;
    
    throw error;
  }
}

// 根据模型类型生成不同的响应
async function generateModelResponse(
  modelType: string, 
  userInput: string, 
  currentState: any
): Promise<{text: string, updatedState: any}> {
  let newState = { ...currentState };
  
  // 确保KWLQ状态存在且是数组
  if (!newState.K || !Array.isArray(newState.K)) newState.K = [];
  if (!newState.W || !Array.isArray(newState.W)) newState.W = [];
  if (!newState.L || !Array.isArray(newState.L)) newState.L = [];
  if (!newState.Q || !Array.isArray(newState.Q)) newState.Q = [];
  
  // 提取当前所有主题
  const topics = [
    ...newState.K, 
    ...newState.W, 
    ...newState.L, 
    ...newState.Q
  ].filter(Boolean);
  
  // 如果没有主题，从提示中提取一些潜在主题
  const extractedTopics = topics.length > 0 ? topics : extractTopicsFromPrompt(userInput);
  
  try {
    // Grok模型处理分支
    if (modelType === 'grok' && hasValidApiKey) {
      try {
        // 构建学生智能体角色提示
        const systemPrompt = `你是一位对学习充满热情的中文学生，正在和AI老师交流。
你使用KWLQ学习模型来组织你的思考:
K (Known/已知) - 你已经掌握的知识
W (Want to know/想知道) - 你想了解的内容
L (Learned/已学) - 通过对话你新学到的内容
Q (Questions/问题) - 你产生的新问题

你的已知概念: ${newState.K.join(', ')}
你想了解的内容: ${newState.W.join(', ')}
你已学到的内容: ${newState.L.join(', ')}
你的疑问: ${newState.Q.join(', ')}

回应用户的问题时，表现得像一个真实的学生，表达好奇心和学习热情。使用自然、积极的语气，提出有意义的问题来深入理解概念。`;
        
        // 构建API请求体
        // 使用与主服务完全一致的API请求格式
        const requestBody = {
          model: "grok-3-fast-beta",
          temperature: 0.7,
          top_p: 0.9, 
          max_tokens: 4096,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userInput
            }
          ]
        };
        
        log(`[StudentAgentSimulator] 调用Grok API生成学生回应...`);
        log(`[StudentAgentSimulator] 使用模型: grok-3-fast-beta, 系统提示词长度: ${systemPrompt.length}字符`);
        log(`[StudentAgentSimulator] API密钥前6个字符: ${grokApiKey?.substring(0, 6) || '未找到'}...`);
        
        let response;
        try {
          // 调用Grok API - 使用标准fetch替代fetchWithRetry
          log(`[StudentAgentSimulator] 使用标准fetch调用API，与主服务保持一致`);
          response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${grokApiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          
          log(`[StudentAgentSimulator] Grok API响应状态: ${response.status}`);
          
          if (response.status === 400) {
            const errorText = await response.text();
            log(`[StudentAgentSimulator] 错误细节: ${errorText}`);
            throw new Error(`API请求失败(400): ${errorText}`);
          }
          
          if (!response.ok) {
            const errorText = await response.text();
            log(`[StudentAgentSimulator] Grok API错误: ${response.status} - ${errorText}`);
            
            if (response.status === 401) {
              log(`[StudentAgentSimulator] API认证失败(401)，切换到模拟响应`);
              throw new Error("API认证失败，使用备用方案");
            } else {
              throw new Error(`Grok API错误: ${response.status} - ${errorText}`);
            }
          }
          
        } catch (error) {
          log(`[StudentAgentSimulator] API请求异常: ${error instanceof Error ? error.message : String(error)}`);
          throw error;
        }
        
        const data = await response.json();
        log(`[StudentAgentSimulator] 成功接收Grok API响应`);
        
        // 提取响应文本
        const responseText = data.choices?.[0]?.message?.content || "无法生成回应";
        
        // 分析响应中可能提到的主题和问题
        const mentionedTopics = extractTopicsFromText(responseText);
        const possibleQuestions = extractQuestionsFromText(responseText);
        
        // 更新KWLQ状态
        for (const topic of mentionedTopics) {
          // 随机决定将主题加入哪个类别
          const rand = Math.random();
          if (rand < 0.2 && !newState.K.includes(topic)) {
            newState.K.push(topic);
          } else if (rand < 0.5 && !newState.W.includes(topic)) {
            newState.W.push(topic);
          } else if (!newState.L.includes(topic)) {
            newState.L.push(topic);
          }
        }
        
        // 添加提取的问题
        for (const question of possibleQuestions) {
          if (!newState.Q.includes(question)) {
            newState.Q.push(question);
          }
        }
        
        return {
          text: responseText,
          updatedState: newState
        };
      } catch (apiError) {
        const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
        log(`[StudentAgentSimulator] Grok API调用失败: ${errorMsg}. 使用模拟响应作为后备方案。`);
        // 继续到模拟响应代码
      }
    } 
    
    // 模拟响应代码 - 处理非Grok模型或API调用失败的情况
    log(`[StudentAgentSimulator] 使用模拟响应 (模型: ${modelType}, API可用: ${hasValidApiKey})`);
    
    // 选择一个随机主题
    const randomTopic = extractedTopics[Math.floor(Math.random() * extractedTopics.length)] || '学习';
    let responseText = '';
    
    switch(modelType) {
      case 'gemini':
        responseText = `我很高兴你对${randomTopic}感兴趣！这是一个非常重要的概念。\n\n${randomTopic}涉及多个方面，包括基本原理、应用场景和最佳实践。在学习过程中，可以先从基础概念入手，逐步深入理解复杂的部分。\n\n你想了解${randomTopic}的哪一部分呢？`;
        
        if (!newState.K.includes(randomTopic) && Math.random() > 0.5) {
          newState.K.push(randomTopic);
        } else if (!newState.L.includes(randomTopic)) {
          newState.L.push(randomTopic);
        }
        break;
        
      case 'deepseek':
        responseText = `关于${randomTopic}，我可以从以下几个角度为你详细解析：\n\n1. 基本定义与概念框架\n2. 历史演变与发展脉络\n3. 核心技术原理\n4. 实际应用案例\n5. 未来发展趋势\n\n${randomTopic}作为一个重要领域，其价值在于连接了理论与实践。你更关注其中的哪个方面？`;
        
        if (Math.random() > 0.7 && !newState.W.includes(randomTopic)) {
          newState.W.push(randomTopic);
        } else if (!newState.L.includes(randomTopic)) {
          newState.L.push(randomTopic);
        }
        break;
        
      case 'grok':
      default:
        responseText = `哈！${randomTopic}是个好问题！简单来说，${randomTopic}就是连接知识点的关键纽带。\n\n不过别被表面现象迷惑，${randomTopic}背后有着丰富的知识体系。无论你从哪个角度切入，都能发现新的视角。\n\n想不想来个有趣的思考实验？假设我们把${randomTopic}应用在完全不同的领域...`;
        
        if (Math.random() > 0.6 && !newState.Q.includes(`${randomTopic}的边界条件是什么？`)) {
          newState.Q.push(`${randomTopic}的边界条件是什么？`);
        }
        
        if (!newState.L.includes(randomTopic)) {
          newState.L.push(randomTopic);
        }
    }
    
    return { 
      text: responseText,
      updatedState: newState
    };
  } catch (error) {
    // 发生错误时，记录并退回到最简单的模板响应
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[StudentAgentSimulator] 生成模型响应失败: ${errorMsg}`);
    
    // 选择一个随机主题并生成简单回应
    const randomTopic = extractedTopics[Math.floor(Math.random() * extractedTopics.length)] || '学习';
    const responseText = `我对${randomTopic}很感兴趣。你能告诉我更多相关信息吗？`;
    
    // 更新KWLQ状态，添加这个主题
    if (!newState.W.includes(randomTopic)) {
      newState.W.push(randomTopic);
    }
    
    return {
      text: responseText,
      updatedState: newState
    };
  }
}

// 从提示中提取潜在主题
function extractTopicsFromPrompt(prompt: string): string[] {
  // 简单实现：分词并提取可能的名词短语
  const words = prompt.split(/\s+/);
  const potentialTopics: string[] = [];
  
  // 尝试提取2-3个词的短语
  for (let i = 0; i < words.length; i++) {
    if (words[i].length > 3) {
      potentialTopics.push(words[i]);
    }
    
    if (i < words.length - 1 && words[i].length > 2 && words[i+1].length > 2) {
      potentialTopics.push(`${words[i]} ${words[i+1]}`);
    }
  }
  
  // 如果没有提取到任何主题，返回默认主题
  return potentialTopics.length > 0 ? potentialTopics : ['学习方法', '知识管理', '教育技术'];
}

/**
 * 从文本中提取潜在主题
 * 与提示词提取类似，但会进行更深入的分析，尝试识别专有名词和关键概念
 */
function extractTopicsFromText(text: string): string[] {
  // 分词并过滤掉过于普通的词汇
  const words = text.split(/[，。！？；：,\.!\?;:\s]+/);
  const potentialTopics: string[] = [];
  
  // 提取单词和短语
  for (let i = 0; i < words.length; i++) {
    // 提取长度大于2的单词
    if (words[i].length > 2) {
      potentialTopics.push(words[i]);
    }
    
    // 提取2-3个词的短语
    if (i < words.length - 1 && words[i].length > 2 && words[i+1].length > 2) {
      potentialTopics.push(`${words[i]}${words[i+1]}`);
    }
    
    if (i < words.length - 2 && words[i].length > 2 && words[i+1].length > 1 && words[i+2].length > 2) {
      potentialTopics.push(`${words[i]}${words[i+1]}${words[i+2]}`);
    }
  }
  
  // 过滤掉重复和无意义的主题
  // 先用普通数组去重，避免Set迭代问题
  const uniqueTopics: string[] = [];
  potentialTopics.forEach(topic => {
    if (!uniqueTopics.includes(topic)) {
      uniqueTopics.push(topic);
    }
  });
  
  const filteredTopics = uniqueTopics
    .filter(topic => topic.length > 2) // 过滤掉太短的主题
    .filter(topic => !['这个', '什么', '一些', '进行', '可以', '我们', '就是', '因为'].includes(topic)); // 过滤常见无意义词
  
  // 保留前5个主题
  return filteredTopics.slice(0, 5);
}

/**
 * 从文本中提取潜在问题
 */
function extractQuestionsFromText(text: string): string[] {
  // 寻找中文问句
  const questionRegexChinese = /([^。？！]+)[？]/g;
  // 寻找问号结尾的句子
  const questionRegexSimple = /([^?!.]+)[?]/g;
  
  const questions: string[] = [];
  
  // 匹配中文问句
  let match;
  while ((match = questionRegexChinese.exec(text)) !== null) {
    const question = match[1].trim() + '？';
    if (question.length > 5 && question.length < 100) { // 只保留合理长度的问题
      questions.push(question);
    }
  }
  
  // 匹配简单问号结尾的句子
  while ((match = questionRegexSimple.exec(text)) !== null) {
    const question = match[1].trim() + '?';
    if (question.length > 5 && question.length < 100 && !questions.includes(question)) {
      questions.push(question);
    }
  }
  
  // 如果通过正则匹配没有找到足够的问题，尝试识别文本中的疑问词
  if (questions.length < 1) {
    const sentences = text.split(/[。；！？\\.;!?]+/).filter(s => s.trim().length > 0);
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // 检查句子是否包含疑问词
      if (
        trimmedSentence.includes('为什么') || 
        trimmedSentence.includes('怎么') || 
        trimmedSentence.includes('如何') || 
        trimmedSentence.includes('是否') ||
        trimmedSentence.includes('多少')
      ) {
        // 确保句子有合理的长度且不重复
        if (trimmedSentence.length > 5 && trimmedSentence.length < 100 && !questions.includes(trimmedSentence)) {
          questions.push(trimmedSentence + '？');
        }
      }
    }
  }
  
  // 返回提取的问题，最多3个
  return questions.slice(0, 3);
}

// 停止模拟会话
function stopSimulation(simulationId: number) {
  const simulation = activeSimulations.get(simulationId);
  
  if (simulation && simulation.interval) {
    clearInterval(simulation.interval);
    simulation.interval = undefined;
    
    // 如果状态是运行中，则更新为已完成
    if (simulation.status === 'running') {
      simulation.status = 'completed';
    }
    
    simulation.endTime = new Date();
    
    log(`[StudentAgentSimulator] 会话 ${simulationId} 已停止，状态: ${simulation.status}`);
    
    // 完成学生智能体会话
    storage.completeStudentAgentSession(simulationId).catch(error => {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      log(`[StudentAgentSimulator] 完成会话 ${simulationId} 失败: ${errorMessage}`);
    });
    
    // 30分钟后从活动会话列表中移除
    setTimeout(() => {
      activeSimulations.delete(simulationId);
      log(`[StudentAgentSimulator] 会话 ${simulationId} 已从活动列表中移除`);
    }, 30 * 60 * 1000);
  }
}

// 生成随机时间间隔 (min-max 毫秒)
function getRandomInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 基于当前状态自动生成下一个问题
async function generateNextQuestion(currentState: any): Promise<string> {
  // 从KWLQ状态中获取学习主题
  const topics = [...(currentState?.K || []), ...(currentState?.W || [])];
  
  // 预定义的问题模板
  const questionTemplates = [
    '我对{topic}感兴趣，能告诉我更多吗？',
    '{topic}的关键概念是什么？',
    '你能解释一下{topic}是如何应用的吗？',
    '{topic}和我们之前讨论的内容有什么关联？',
    '为什么{topic}这么重要？',
    '{topic}的历史背景是什么？',
    '我对{topic}有些混淆，你能再解释一下吗？',
    '{topic}在实际生活中有什么例子？',
    '学习{topic}需要掌握哪些基础知识？',
    '你能推荐一些关于{topic}的学习资源吗？'
  ];
  
  // 随机选择一个主题和问题模板
  const randomTopic = topics[Math.floor(Math.random() * topics.length)] || '这个主题';
  const randomTemplate = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
  
  // 生成问题
  const question = randomTemplate.replace('{topic}', randomTopic);
  
  return question;
}

// 从对话创建记忆
/**
 * 从模拟对话创建记忆
 * @param userId 用户ID
 * @param userQuestion 用户问题
 * @param assistantResponse 助手回答
 * @param kwlqState KWLQ学习状态
 */
async function createMemoryFromConversation(
  userId: number, 
  userQuestion: string, 
  assistantResponse: string,
  kwlqState: Record<string, string[]>
): Promise<void> {
  try {
    // 构建基础对话内容
    let content = `问: ${userQuestion}\n\n答: ${assistantResponse}`;
    
    // 添加KWLQ学习状态信息
    if (kwlqState) {
      // 将K部分添加到内容中
      if (kwlqState.K && Array.isArray(kwlqState.K) && kwlqState.K.length > 0) {
        content = content + `\n\n已知信息: ${kwlqState.K.join(', ')}`;
      }
      
      // 将W部分添加到内容中
      if (kwlqState.W && Array.isArray(kwlqState.W) && kwlqState.W.length > 0) {
        content = content + `\n\n想要了解: ${kwlqState.W.join(', ')}`;
      }
      
      // 将L部分添加到内容中
      if (kwlqState.L && Array.isArray(kwlqState.L) && kwlqState.L.length > 0) {
        content = content + `\n\n已学习: ${kwlqState.L.join(', ')}`;
      }
      
      // 将Q部分添加到内容中
      if (kwlqState.Q && Array.isArray(kwlqState.Q) && kwlqState.Q.length > 0) {
        content = content + `\n\n疑问: ${kwlqState.Q.join(', ')}`;
      }
    }
    
    // 创建记忆
    try {
      const memory = await memoryService.createMemory(
        userId,
        content,
        '学生智能体模拟对话' // 记忆类型
      );
      
      if (memory && memory.id) {
        log(`[StudentAgentSimulator] 已为用户 ${userId} 创建记忆: ${memory.id}`);
      } else {
        log(`[StudentAgentSimulator] 记忆创建成功但未返回ID，用户: ${userId}`);
      }
    } catch (memoryError) {
      const errorMsg = memoryError instanceof Error ? memoryError.message : String(memoryError);
      log(`[StudentAgentSimulator] 记忆创建过程中出错: ${errorMsg}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[StudentAgentSimulator] 创建记忆失败: ${errorMsg}`);
  }
}

// Export the router with named export
export { router };