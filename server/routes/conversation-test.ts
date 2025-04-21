/**
 * 对话分析和提示词测试路由
 * 用于测试对话分析系统和动态提示词注入功能
 */
import express from 'express';
import { storage } from '../storage';
import { log } from '../vite';
import { conversationAnalyticsService } from '../services/conversation-analytics';
import { promptManagerService } from '../services/prompt-manager';
import { type Message } from '../../shared/schema';

// 用于测试的内存存储
const testMemory = {
  // 模拟的聊天ID映射，用于避免外键约束错误
  chatIdMap: new Map<number, number>(),
  // 模拟的对话阶段分析结果
  phaseResults: new Map<number, { phase: string, summary: string }>(),
  // 记录是否已创建测试用户和聊天
  initialized: false
};

const router = express.Router();

// 分析对话并返回对话阶段
router.post('/analyze-conversation', async (req, res) => {
  try {
    const { chatId, messages } = req.body;
    
    if (!chatId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: '无效的请求数据，需要有效的chatId和消息数组' 
      });
    }
    
    // 调用对话分析服务
    const result = await conversationAnalyticsService.analyzeConversationPhase(chatId, messages);
    
    if (!result) {
      return res.status(500).json({ error: '对话分析失败' });
    }
    
    res.json(result);
  } catch (error) {
    log(`分析对话API错误: ${error}`);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建或更新提示词模板
router.post('/admin/prompt-templates', async (req, res) => {
  try {
    const { 
      modelId, 
      promptTemplate,
      baseTemplate,
      kTemplate,
      wTemplate,
      lTemplate,
      qTemplate,
      styleTemplate,
      policyTemplate,
      sensitiveWords 
    } = req.body;
    
    if (!modelId) {
      return res.status(400).json({ error: '缺少必要参数：modelId' });
    }
    
    // 检查模板是否已存在
    const existingTemplate = await storage.getPromptTemplate(modelId);
    
    if (existingTemplate) {
      // TODO: 更新已有模板
      // 注意：这里是模拟的代码，实际实现需要根据storage接口添加相应的方法
      // 这里直接返回现有模板，模拟更新成功
      const updatedTemplate = existingTemplate;
      
      return res.json({
        success: true,
        message: '提示词模板更新成功',
        template: updatedTemplate
      });
    } else {
      // TODO: 创建新模板
      // 注意：这里是模拟的代码，实际实现需要根据storage接口添加相应的方法
      // 创建一个模拟的模板对象
      const newTemplate = {
        id: 1,
        modelId,
        promptTemplate: promptTemplate || '',
        baseTemplate: baseTemplate || '',
        kTemplate: kTemplate || '',
        wTemplate: wTemplate || '',
        lTemplate: lTemplate || '',
        qTemplate: qTemplate || '',
        styleTemplate: styleTemplate || '',
        policyTemplate: policyTemplate || '',
        sensitiveWords: sensitiveWords || '',
        updatedAt: new Date(),
        createdBy: req.session?.userId || 1
      };
      
      return res.json({
        success: true,
        message: '提示词模板创建成功',
        template: newTemplate
      });
    }
  } catch (error) {
    log(`创建/更新提示词模板API错误: ${error}`);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 生成动态提示词
router.post('/generate-prompt', async (req, res) => {
  try {
    const { modelId, chatId, userInput, contextMemories, searchResults } = req.body;
    
    if (!modelId || !chatId || !userInput) {
      return res.status(400).json({ 
        error: '缺少必要参数，需要modelId、chatId和userInput' 
      });
    }
    
    // 调用提示词管理服务
    const prompt = await promptManagerService.getDynamicPrompt(
      modelId,
      chatId,
      userInput,
      contextMemories,
      searchResults
    );
    
    res.json({ 
      success: true,
      prompt 
    });
  } catch (error) {
    log(`生成动态提示词API错误: ${error}`);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 简单健康检查接口
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default router;