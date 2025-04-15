/**
 * 内容审查设置路由
 */

import { Router, Request, Response } from 'express';
import { contentModerationService, ModerationSettings } from '../services/content-moderation';
import { requireAdmin } from '../middleware/auth';
import { log } from '../vite';

const router = Router();

// 获取当前内容审查设置
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = contentModerationService.getSettings();
    const apiKeyConfigured = !!process.env.OPENAI_API_KEY;
    
    res.json({
      success: true,
      settings,
      apiConfigured: apiKeyConfigured,
      message: apiKeyConfigured ? undefined : 'OpenAI API密钥未配置或无法读取，内容审查功能将不可用'
    });
  } catch (error) {
    log(`Error getting content moderation settings: ${error}`);
    res.status(500).json({
      success: false,
      message: '获取内容审查设置失败'
    });
  }
});

// 更新内容审查设置
router.post('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled, threshold, blockUserInput, blockModelOutput } = req.body;
    
    // 验证输入
    const settings: Partial<ModerationSettings> = {};
    
    if (typeof enabled === 'boolean') {
      settings.enabled = enabled;
    }
    
    if (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) {
      settings.threshold = threshold;
    }
    
    if (typeof blockUserInput === 'boolean') {
      settings.blockUserInput = blockUserInput;
    }
    
    if (typeof blockModelOutput === 'boolean') {
      settings.blockModelOutput = blockModelOutput;
    }
    
    // 更新设置
    contentModerationService.updateSettings(settings);
    
    // 返回更新后的设置
    const updatedSettings = contentModerationService.getSettings();
    
    res.json({
      success: true,
      settings: updatedSettings,
      message: '内容审查设置已更新'
    });
  } catch (error) {
    log(`Error updating content moderation settings: ${error}`);
    res.status(500).json({
      success: false,
      message: '更新内容审查设置失败'
    });
  }
});

// 测试内容审查 - 提供给管理员测试审查功能
router.post('/test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: '请提供有效的文本内容'
      });
    }
    
    // 执行内容审查
    const result = await contentModerationService.moderateContent(text);
    
    res.json({
      success: true,
      result,
      message: result.flagged ? '内容已被标记' : '内容通过审查'
    });
  } catch (error) {
    log(`Error testing content moderation: ${error}`);
    res.status(500).json({
      success: false,
      message: '内容审查测试失败'
    });
  }
});

export default router;