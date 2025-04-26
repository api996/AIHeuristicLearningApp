/**
 * 学生智能体API路由
 * 提供创建和管理虚拟学生智能体的接口
 */

import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';
import { studentAgentService } from '../services/student-agent';

const router = express.Router();

// 中间件：验证管理员权限
const validateAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = req.query.userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "未提供用户ID" });
    }
    
    const user = await storage.getUser(Number(userId));
    if (!user) {
      return res.status(404).json({ success: false, message: "用户不存在" });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "需要管理员权限" });
    }
    
    next();
  } catch (error) {
    log(`[StudentAgentAPI] 权限验证错误: ${error}`);
    res.status(500).json({ success: false, message: "服务器错误" });
  }
};

// 获取所有学生智能体预设
router.get('/presets', validateAdmin, async (req: Request, res: Response) => {
  try {
    const presets = await studentAgentService.getAllPresets();
    res.json({ success: true, presets });
  } catch (error) {
    log(`[StudentAgentAPI] 获取预设错误: ${error}`);
    res.status(500).json({ success: false, message: "获取学生智能体预设失败" });
  }
});

// 获取特定学生智能体预设
router.get('/presets/:id', validateAdmin, async (req: Request, res: Response) => {
  try {
    const presetId = parseInt(req.params.id);
    if (isNaN(presetId)) {
      return res.status(400).json({ success: false, message: "无效的预设ID" });
    }
    
    const preset = await studentAgentService.getPreset(presetId);
    if (!preset) {
      return res.status(404).json({ success: false, message: "预设不存在" });
    }
    
    res.json({ success: true, preset });
  } catch (error) {
    log(`[StudentAgentAPI] 获取预设错误: ${error}`);
    res.status(500).json({ success: false, message: "获取学生智能体预设失败" });
  }
});

// 创建学生智能体预设
router.post('/presets', validateAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      subject, 
      gradeLevel,
      cognitiveLevel,
      motivationLevel,
      learningStyle,
      personalityTrait,
      systemPrompt,
      kwlqTemplate,
      challengeAreas,
      commonMisconceptions
    } = req.body;
    
    // 验证必要字段
    if (!name || !subject || !gradeLevel) {
      return res.status(400).json({ 
        success: false, 
        message: "缺少必要字段: name, subject, gradeLevel" 
      });
    }
    
    const preset = await studentAgentService.createPreset({
      name,
      description,
      subject,
      gradeLevel,
      cognitiveLevel,
      motivationLevel,
      learningStyle,
      personalityTrait,
      systemPrompt,
      kwlqTemplate,
      challengeAreas,
      commonMisconceptions,
      createdBy: Number(req.body.userId)
    });
    
    res.status(201).json({ success: true, preset });
  } catch (error) {
    log(`[StudentAgentAPI] 创建预设错误: ${error}`);
    res.status(500).json({ success: false, message: `创建学生智能体预设失败: ${error.message}` });
  }
});

// 更新学生智能体预设
router.patch('/presets/:id', validateAdmin, async (req: Request, res: Response) => {
  try {
    const presetId = parseInt(req.params.id);
    if (isNaN(presetId)) {
      return res.status(400).json({ success: false, message: "无效的预设ID" });
    }
    
    // 获取原始预设
    const existingPreset = await storage.getStudentAgentPreset(presetId);
    if (!existingPreset) {
      return res.status(404).json({ success: false, message: "预设不存在" });
    }
    
    // 更新预设
    const updatedPreset = await storage.updateStudentAgentPreset(presetId, {
      ...req.body,
      updatedAt: new Date()
    });
    
    res.json({ success: true, preset: updatedPreset });
  } catch (error) {
    log(`[StudentAgentAPI] 更新预设错误: ${error}`);
    res.status(500).json({ success: false, message: `更新学生智能体预设失败: ${error.message}` });
  }
});

// 删除学生智能体预设
router.delete('/presets/:id', validateAdmin, async (req: Request, res: Response) => {
  try {
    const presetId = parseInt(req.params.id);
    if (isNaN(presetId)) {
      return res.status(400).json({ success: false, message: "无效的预设ID" });
    }
    
    await storage.deleteStudentAgentPreset(presetId);
    res.json({ success: true, message: "预设已删除" });
  } catch (error) {
    log(`[StudentAgentAPI] 删除预设错误: ${error}`);
    res.status(500).json({ success: false, message: `删除学生智能体预设失败: ${error.message}` });
  }
});

// 获取用户的所有会话
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId;
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ success: false, message: "无效的用户ID" });
    }
    
    const sessions = await studentAgentService.getUserSessions(Number(userId));
    res.json({ success: true, sessions });
  } catch (error) {
    log(`[StudentAgentAPI] 获取会话错误: ${error}`);
    res.status(500).json({ success: false, message: "获取学生智能体会话失败" });
  }
});

// 创建新会话
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, presetId, learningTopic } = req.body;
    
    if (!userId || !presetId || !learningTopic) {
      return res.status(400).json({ 
        success: false, 
        message: "缺少必要字段: userId, presetId, learningTopic" 
      });
    }
    
    const session = await studentAgentService.createSession(
      Number(userId),
      Number(presetId),
      learningTopic
    );
    
    res.status(201).json({ success: true, session });
  } catch (error) {
    log(`[StudentAgentAPI] 创建会话错误: ${error}`);
    res.status(500).json({ success: false, message: `创建学生智能体会话失败: ${error.message}` });
  }
});

// 获取会话消息
router.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "无效的会话ID" });
    }
    
    const messages = await studentAgentService.getSessionMessages(sessionId);
    res.json({ success: true, messages });
  } catch (error) {
    log(`[StudentAgentAPI] 获取会话消息错误: ${error}`);
    res.status(500).json({ success: false, message: "获取会话消息失败" });
  }
});

// 发送消息给学生智能体
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "无效的会话ID" });
    }
    
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: "消息内容不能为空" });
    }
    
    const result = await studentAgentService.sendMessageToStudent(sessionId, content);
    
    res.json({ 
      success: true, 
      response: result.response,
      state: result.updatedState
    });
  } catch (error) {
    log(`[StudentAgentAPI] 发送消息错误: ${error}`);
    res.status(500).json({ success: false, message: `发送消息失败: ${error.message}` });
  }
});

// 完成会话
router.post('/sessions/:id/complete', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "无效的会话ID" });
    }
    
    await storage.completeStudentAgentSession(sessionId);
    res.json({ success: true, message: "会话已标记为完成" });
  } catch (error) {
    log(`[StudentAgentAPI] 完成会话错误: ${error}`);
    res.status(500).json({ success: false, message: `标记会话完成失败: ${error.message}` });
  }
});

// 创建会话评估
router.post('/sessions/:id/evaluations', validateAdmin, async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "无效的会话ID" });
    }
    
    const { 
      evaluatorId,
      realismScore,
      learningTrajectoryScore,
      kwlqCompletionRate,
      languageDiversityScore,
      comments
    } = req.body;
    
    if (!evaluatorId || !realismScore || !learningTrajectoryScore || !kwlqCompletionRate) {
      return res.status(400).json({ 
        success: false, 
        message: "缺少必要字段: evaluatorId, realismScore, learningTrajectoryScore, kwlqCompletionRate" 
      });
    }
    
    const evaluation = await storage.createStudentAgentEvaluation(
      sessionId,
      Number(evaluatorId),
      Number(realismScore),
      Number(learningTrajectoryScore),
      Number(kwlqCompletionRate),
      languageDiversityScore ? Number(languageDiversityScore) : undefined,
      comments
    );
    
    res.status(201).json({ success: true, evaluation });
  } catch (error) {
    log(`[StudentAgentAPI] 创建评估错误: ${error}`);
    res.status(500).json({ success: false, message: `创建会话评估失败: ${error.message}` });
  }
});

// 获取会话评估
router.get('/sessions/:id/evaluations', validateAdmin, async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "无效的会话ID" });
    }
    
    const evaluations = await storage.getStudentAgentEvaluationsBySession(sessionId);
    res.json({ success: true, evaluations });
  } catch (error) {
    log(`[StudentAgentAPI] 获取评估错误: ${error}`);
    res.status(500).json({ success: false, message: "获取会话评估失败" });
  }
});

export default router;