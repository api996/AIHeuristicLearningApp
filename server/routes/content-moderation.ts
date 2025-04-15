/**
 * 内容审查设置路由
 */

import { Router, Request, Response } from 'express';
import { contentModerationService, ModerationSettings } from '../services/content-moderation';
import { requireAdmin } from '../middleware/auth';
import { log } from '../vite';

const router = Router();

/**
 * 获取内容审查设置
 */
router.get('/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const settings = contentModerationService.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    log(`获取内容审查设置失败: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: '获取内容审查设置失败' 
    });
  }
});

/**
 * 更新内容审查设置
 */
router.post('/settings', requireAdmin, (req: Request, res: Response) => {
  try {
    const { enabled, threshold, blockUserInput, blockModelOutput } = req.body;
    
    // 验证参数
    if (threshold !== undefined && (threshold < 0 || threshold > 1)) {
      return res.status(400).json({ 
        success: false, 
        message: '阈值必须在0到1之间' 
      });
    }
    
    // 更新设置
    const newSettings: Partial<ModerationSettings> = {};
    
    if (enabled !== undefined) newSettings.enabled = !!enabled;
    if (threshold !== undefined) newSettings.threshold = threshold;
    if (blockUserInput !== undefined) newSettings.blockUserInput = !!blockUserInput;
    if (blockModelOutput !== undefined) newSettings.blockModelOutput = !!blockModelOutput;
    
    const settings = contentModerationService.updateSettings(newSettings);
    
    log(`内容审查设置已更新: ${JSON.stringify(settings)}`);
    
    res.json({ 
      success: true, 
      settings,
      message: '内容审查设置已更新'
    });
  } catch (error) {
    log(`更新内容审查设置失败: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: '更新内容审查设置失败' 
    });
  }
});

/**
 * 测试内容审查
 */
router.post('/test', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: '请提供有效的测试文本' 
      });
    }
    
    // 执行内容审查测试
    const result = await contentModerationService.moderateContent(text);
    
    res.json({ 
      success: true, 
      result,
      message: '内容审查测试完成'
    });
  } catch (error) {
    log(`内容审查测试失败: ${error}`);
    res.status(500).json({ 
      success: false, 
      message: '内容审查测试失败' 
    });
  }
});

export default router;