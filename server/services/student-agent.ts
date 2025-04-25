/**
 * 学生智能体服务
 * 基于KWLQ框架和提示词模板模拟学生行为
 */

import { storage } from '../storage';
import { log } from '../vite';
import { StudentAgentPreset, StudentAgentSession, StudentAgentMessage } from '../../shared/schema';
import { ChatService, chatService } from './chat';
import fs from 'fs';
import path from 'path';

// Grok API密钥环境变量
const GROK_API_KEY = process.env.GROK_API_KEY;

class StudentAgentService {
  private service: ChatService;
  private systemPromptTemplate: string;
  
  constructor() {
    this.service = chatService;
    
    // 加载默认系统提示词模板
    try {
      const templatePath = path.join(process.cwd(), 'server', 'services', 'templates', 'student-agent-system-prompt.txt');
      if (fs.existsSync(templatePath)) {
        this.systemPromptTemplate = fs.readFileSync(templatePath, 'utf-8');
        log(`[StudentAgentService] 已加载系统提示词模板`);
      } else {
        // 如果文件不存在，使用默认模板
        this.systemPromptTemplate = this.getDefaultSystemPrompt();
        log(`[StudentAgentService] 使用默认系统提示词模板`);
      }
    } catch (error) {
      log(`[StudentAgentService] 加载系统提示词模板出错: ${error}`);
      this.systemPromptTemplate = this.getDefaultSystemPrompt();
    }
    
    log(`[StudentAgentService] 初始化完成`);
  }
  
  /**
   * 获取默认的系统提示词模板
   */
  private getDefaultSystemPrompt(): string {
    return `### 🧠 角色总纲
你是一名虚拟学生，用于测试导师智能体。请始终保持真实、连贯、可变的学习行为，而非完美专家。

---

#### 0. 变量初始化
- 姓名: {{name}}  
- 年龄: {{age}}  
- 就读: {{schoolType}}，年级/学期 {{grade}}  
- 学科焦点: {{subject}}  
- 认知能力: {{cognitiveLevel}} => 变量 cog_level  
- 先验知识概述: {{priorKnowledge}}  
- 学习风格: {{learningStyle}}  
- 动机基线: {{motivationLevel}} => 变量 motivation (0-100)  
- 社交倾向: {{personalityTrait}}  
- 特定挑战: {{challenges}}

---

#### 1. KWLQ 学习记录表（四列随着对话滚动更新）
| K 我已知道 | W 我想学 | L 我已学会 | Q 仍存疑问 |
|------------|---------|-----------|-----------|
| {{K}} | {{W}} | {{L}} | {{Q}} |

> 每当收到导师解释后：  
> - 若理解 ≥80% → 将概念移至 L 并输出「我明白了…」  
> - 若仍困惑 → 生成跟进问题写入 Q 列

---

#### 2. 行为规则
1. **认知负荷调节**  
   - cog_level=低 → 每 2-3 回合出现明确困惑；用短句、比喻要求再解释  
   - cog_level=高 → 可提出跨学科链接或反驳

2. **动机波动**  
   - 若 3 回合内未完成目标且 motivation<40：输出分心迹象（"抱歉刚刚走神了"）  
   - 若导师采用多模态材料符合学习风格 → motivation+10

3. **苏格拉底式互动**  
   - 当导师抛出问题时，先自问自答：  
     我的假设: …  
     我的推理: …  
     所需证据: …  
   - 如无法回答，坦诚表达并请求提示

4. **语言自然度**  
   - 每 8-12 句加入一次非正式语气/口语或轻微键盘错字（≤3 字符）  
   - 保持符合年龄段的句式长度（平均 15±5 词）

5. **错误 & 纠正**  
   - 至少 10% 概率引入概念性错误，允许导师纠正  
   - 被纠正后使用元认知句式反思（"我犯错是因为…下次我会…"）

---

#### 3. 学科特定策略
- 常见误区库：  
  {{commonMisconceptions}}
- 遇到上述概念时按 30%-40% 概率踩坑

---

#### 4. 交互结束条件
- 满足以下两条即刻输出「阶段总结」：  
  1. W 列全部移入 L  
  2. motivation>=50 且最近 2 回合无新增 Q

---

#### 5. 输出格式
始终先给出「学生自述」，随后(若需)在方括号中更新内部状态，例如

我觉得这个概念有点难理解，能再解释一下吗？
[State: motivation=65, confusion=moderate]`;
  }
  
  /**
   * 创建学生智能体预设
   */
  async createPreset(presetData: Partial<StudentAgentPreset>): Promise<StudentAgentPreset> {
    try {
      // 如果没有提供系统提示词，使用默认模板并填充变量
      if (!presetData.systemPrompt) {
        let systemPrompt = this.systemPromptTemplate;
        
        // 替换常见占位符
        const replacements: Record<string, string> = {
          "{{name}}": presetData.name || "测试学生",
          "{{age}}": "16",
          "{{schoolType}}": presetData.gradeLevel?.includes("高中") ? "高中" : "初中",
          "{{grade}}": presetData.gradeLevel || "高中一年级",
          "{{subject}}": presetData.subject || "综合学科",
          "{{cognitiveLevel}}": presetData.cognitiveLevel || "medium",
          "{{priorKnowledge}}": "基本了解该学科的基础概念",
          "{{learningStyle}}": presetData.learningStyle || "visual",
          "{{motivationLevel}}": presetData.motivationLevel || "medium",
          "{{personalityTrait}}": presetData.personalityTrait || "balanced",
          "{{challenges}}": presetData.challengeAreas || "",
          "{{K}}": "基础知识点",
          "{{W}}": presetData.subject || "本学科知识",
          "{{L}}": "",
          "{{Q}}": ""
        };
        
        // 替换所有占位符
        Object.entries(replacements).forEach(([key, value]) => {
          systemPrompt = systemPrompt.replace(key, value);
        });
        
        // 处理常见误区
        let misconceptions = "";
        if (presetData.commonMisconceptions && Array.isArray(presetData.commonMisconceptions)) {
          misconceptions = presetData.commonMisconceptions.map((m, i) => `${i + 1}. ${m}`).join('\n  ');
        }
        systemPrompt = systemPrompt.replace("{{commonMisconceptions}}", misconceptions || "暂无特定误区记录");
        
        presetData.systemPrompt = systemPrompt;
      }
      
      // 确保必填字段
      const fullPresetData: any = {
        name: presetData.name || "通用学生",
        description: presetData.description || `${presetData.subject || "通用"}学科的虚拟学生配置`,
        subject: presetData.subject || "通用学科",
        gradeLevel: presetData.gradeLevel || "高中",
        cognitiveLevel: presetData.cognitiveLevel || "medium",
        motivationLevel: presetData.motivationLevel || "medium",
        learningStyle: presetData.learningStyle || "visual",
        personalityTrait: presetData.personalityTrait || "balanced",
        systemPrompt: presetData.systemPrompt,
        kwlqTemplate: presetData.kwlqTemplate || {
          K: ["基础知识"],
          W: [presetData.subject || "学科知识"],
          L: [],
          Q: []
        },
        challengeAreas: presetData.challengeAreas || "",
        commonMisconceptions: presetData.commonMisconceptions || [],
        createdBy: presetData.createdBy || 1, // 默认管理员创建
        isActive: true
      };
      
      return await storage.createStudentAgentPreset(fullPresetData);
    } catch (error) {
      log(`[StudentAgentService] 创建预设错误: ${error}`);
      throw error;
    }
  }
  
  /**
   * 获取所有预设
   */
  async getAllPresets(): Promise<StudentAgentPreset[]> {
    return await storage.getAllStudentAgentPresets();
  }
  
  /**
   * 获取特定预设
   */
  async getPreset(presetId: number): Promise<StudentAgentPreset | undefined> {
    return await storage.getStudentAgentPreset(presetId);
  }
  
  /**
   * 创建新会话
   */
  async createSession(
    userId: number,
    presetId: number,
    learningTopic: string
  ): Promise<StudentAgentSession> {
    try {
      // 获取预设，确保其存在
      const preset = await storage.getStudentAgentPreset(presetId);
      if (!preset) {
        throw new Error(`预设不存在: ${presetId}`);
      }
      
      // 创建会话
      const session = await storage.createStudentAgentSession(userId, presetId, learningTopic);
      
      // 添加系统消息作为会话的开始
      await storage.createStudentAgentMessage(
        session.id,
        "会话已初始化。学生准备好开始学习。",
        "system",
        session.currentState,
        "none"
      );
      
      return session;
    } catch (error) {
      log(`[StudentAgentService] 创建会话错误: ${error}`);
      throw error;
    }
  }
  
  /**
   * 获取会话消息
   */
  async getSessionMessages(sessionId: number): Promise<StudentAgentMessage[]> {
    return await storage.getStudentAgentSessionMessages(sessionId);
  }
  
  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId: number): Promise<StudentAgentSession[]> {
    return await storage.getStudentAgentSessionsByUser(userId);
  }
  
  /**
   * 发送消息给学生智能体并获取回复
   */
  async sendMessageToStudent(
    sessionId: number,
    content: string
  ): Promise<{ response: string; updatedState: any }> {
    try {
      // 获取会话
      const session = await storage.getStudentAgentSession(sessionId);
      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`);
      }
      
      // 获取预设
      const preset = await storage.getStudentAgentPreset(session.presetId);
      if (!preset) {
        throw new Error(`预设不存在: ${session.presetId}`);
      }
      
      // 获取会话历史
      const messageHistory = await storage.getStudentAgentSessionMessages(sessionId);
      
      // 记录导师消息
      await storage.createStudentAgentMessage(
        sessionId,
        content,
        "tutor",
        session.currentState,
        "none"
      );
      
      // 准备发送到Grok API的消息
      const messages = messageHistory.map(msg => ({
        role: msg.role === "student" ? "user" : msg.role === "tutor" ? "assistant" : "system",
        content: msg.content
      }));
      
      // 添加当前导师的消息
      messages.push({
        role: "assistant",
        content
      });
      
      // 添加系统提示词作为第一条消息(如果没有)
      if (!messages.some(m => m.role === "system")) {
        messages.unshift({
          role: "system",
          content: preset.systemPrompt
        });
      }
      
      // 调用Grok API
      const grokResponse = await this.callGrokAPI(messages);
      
      // 解析响应，提取状态更新
      const { responseText, stateUpdate } = this.parseStudentResponse(grokResponse, session.currentState);
      
      // 更新会话状态
      const updatedSession = await storage.updateStudentAgentSessionState(
        sessionId,
        stateUpdate,
        stateUpdate.motivation,
        stateUpdate.confusion
      );
      
      // 确定KWLQ更新类型
      let kwlqUpdateType: "K" | "W" | "L" | "Q" | "none" = "none";
      let kwlqUpdateContent = "";
      
      // 确保KWLQ结构的类型定义
      type KWLQData = {
        K: string[];
        W: string[];
        L: string[];
        Q: string[];
      };
      
      if (stateUpdate.kwlq) {
        // 比较新旧KWLQ数据，确定更新类型
        const currentStateObj = session.currentState || {};
        const oldStateKwlq = (currentStateObj as any).kwlq || { K: [], W: [], L: [], Q: [] };
        const oldKwlq: KWLQData = {
          K: Array.isArray(oldStateKwlq.K) ? oldStateKwlq.K : [],
          W: Array.isArray(oldStateKwlq.W) ? oldStateKwlq.W : [],
          L: Array.isArray(oldStateKwlq.L) ? oldStateKwlq.L : [],
          Q: Array.isArray(oldStateKwlq.Q) ? oldStateKwlq.Q : []
        };
        
        const newStateKwlq = stateUpdate.kwlq;
        const newKwlq: KWLQData = {
          K: Array.isArray(newStateKwlq.K) ? newStateKwlq.K : [],
          W: Array.isArray(newStateKwlq.W) ? newStateKwlq.W : [],
          L: Array.isArray(newStateKwlq.L) ? newStateKwlq.L : [],
          Q: Array.isArray(newStateKwlq.Q) ? newStateKwlq.Q : []
        };
        
        const findNewItems = (newArr: string[], oldArr: string[]): string[] => {
          return newArr.filter(item => !oldArr.includes(item));
        };
        
        const newK = findNewItems(newKwlq.K, oldKwlq.K);
        const newW = findNewItems(newKwlq.W, oldKwlq.W);
        const newL = findNewItems(newKwlq.L, oldKwlq.L);
        const newQ = findNewItems(newKwlq.Q, oldKwlq.Q);
        
        if (newL.length > 0) {
          kwlqUpdateType = "L";
          kwlqUpdateContent = newL.join(', ');
        } else if (newQ.length > 0) {
          kwlqUpdateType = "Q";
          kwlqUpdateContent = newQ.join(', ');
        } else if (newW.length > 0) {
          kwlqUpdateType = "W";
          kwlqUpdateContent = newW.join(', ');
        } else if (newK.length > 0) {
          kwlqUpdateType = "K";
          kwlqUpdateContent = newK.join(', ');
        }
      }
      
      // 记录学生回复
      await storage.createStudentAgentMessage(
        sessionId,
        responseText,
        "student",
        updatedSession.currentState,
        kwlqUpdateType,
        kwlqUpdateContent
      );
      
      return {
        response: responseText,
        updatedState: updatedSession.currentState
      };
    } catch (error) {
      log(`[StudentAgentService] 发送消息错误: ${error}`);
      throw error;
    }
  }
  
  /**
   * 调用Grok API获取学生回复
   */
  private async callGrokAPI(messages: Array<{role: string; content: string}>): Promise<string> {
    try {
      if (!GROK_API_KEY) {
        throw new Error("未配置GROK_API_KEY环境变量");
      }
      
      // 构建请求
      const requestBody = {
        model: "grok-3-fast-beta", // 使用Grok 3 Fast模型，减少延迟
        messages,
        max_tokens: 800,
        temperature: 0.7, // 适当的温度使得学生行为更加自然
      };
      
      // 发送API请求
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const responseText = data.choices[0]?.message?.content || "对不起，我现在无法回答。";
      
      return responseText;
    } catch (error) {
      log(`[StudentAgentService] 调用Grok API错误: ${error}`);
      // 返回后备回复
      return "对不起，我现在有点走神了，能再解释一下吗？[State: motivation=45, confusion=high]";
    }
  }
  
  /**
   * 解析学生回复，提取状态更新
   */
  private parseStudentResponse(
    response: string, 
    currentState: any
  ): { responseText: string; stateUpdate: any } {
    try {
      // 深拷贝当前状态
      const stateUpdate = JSON.parse(JSON.stringify(currentState || {}));
      
      // 默认值
      if (!stateUpdate.motivation) stateUpdate.motivation = 60;
      if (!stateUpdate.confusion) stateUpdate.confusion = 30;
      
      // 确保KWLQ结构存在
      if (!stateUpdate.kwlq) {
        stateUpdate.kwlq = { 
          K: [] as string[], 
          W: [] as string[], 
          L: [] as string[], 
          Q: [] as string[] 
        };
      }
      
      // 尝试提取状态信息
      const stateMatch = response.match(/\[State:([^\]]+)\]/i);
      let responseText = response;
      
      if (stateMatch) {
        const stateText = stateMatch[1];
        
        // 移除状态信息，得到纯文本回复
        responseText = response.replace(/\[State:[^\]]+\]/i, '').trim();
        
        // 解析状态信息
        const motivationMatch = stateText.match(/motivation\s*=\s*(\d+)/i);
        if (motivationMatch) {
          stateUpdate.motivation = parseInt(motivationMatch[1], 10);
        }
        
        const confusionMatch = stateText.match(/confusion\s*=\s*(high|medium|low|none|\d+)/i);
        if (confusionMatch) {
          const confusionValue = confusionMatch[1].toLowerCase();
          if (confusionValue === 'high') {
            stateUpdate.confusion = 80;
          } else if (confusionValue === 'medium') {
            stateUpdate.confusion = 50;
          } else if (confusionValue === 'low') {
            stateUpdate.confusion = 20;
          } else if (confusionValue === 'none') {
            stateUpdate.confusion = 0;
          } else {
            stateUpdate.confusion = parseInt(confusionValue, 10);
          }
        }
      }
      
      // 确保KWLQ结构的每个字段都存在且为数组
      const kwlq = stateUpdate.kwlq as { K: string[], W: string[], L: string[], Q: string[] };
      if (!Array.isArray(kwlq.K)) kwlq.K = [];
      if (!Array.isArray(kwlq.W)) kwlq.W = [];
      if (!Array.isArray(kwlq.L)) kwlq.L = [];
      if (!Array.isArray(kwlq.Q)) kwlq.Q = [];
      
      // 解析KWLQ更新
      // 检测"我已经理解了..."或类似句式，更新L列
      if (/我(已经|现在)?(明白|理解|学会|掌握)了/.test(responseText)) {
        // 尝试提取学会的内容
        const learnedMatch = responseText.match(/我(已经|现在)?(明白|理解|学会|掌握)了([^,.!?。，！？]+)/);
        if (learnedMatch && learnedMatch[3]) {
          const learned = learnedMatch[3].trim();
          if (learned && !kwlq.L.includes(learned)) {
            kwlq.L.push(learned);
            
            // 从W列移除(如果存在)
            kwlq.W = kwlq.W.filter((item: string) => item !== learned);
          }
        }
      }
      
      // 检测问题，更新Q列
      const questionMatches = responseText.match(/我(想问|有个问题|不理解|疑惑)([^,.!?。，！？]+)[?？]/g);
      if (questionMatches) {
        questionMatches.forEach(match => {
          const question = match.trim();
          if (question && !kwlq.Q.includes(question)) {
            kwlq.Q.push(question);
          }
        });
      }
      
      // 更新时间戳
      stateUpdate.lastUpdated = new Date().toISOString();
      
      return { responseText, stateUpdate };
    } catch (error) {
      log(`[StudentAgentService] 解析学生回复错误: ${error}`);
      // 返回原始回复和当前状态
      return {
        responseText: response,
        stateUpdate: currentState || { 
          motivation: 60, 
          confusion: 30,
          kwlq: { 
            K: [] as string[], 
            W: [] as string[], 
            L: [] as string[], 
            Q: [] as string[] 
          },
          lastUpdated: new Date().toISOString()
        }
      };
    }
  }
}

export const studentAgentService = new StudentAgentService();