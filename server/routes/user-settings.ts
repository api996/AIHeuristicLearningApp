/**
 * 用户设置路由
 * 处理用户主题、字体大小等偏好设置的保存和加载
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';
import { utils } from '../utils';

const router = Router();

/**
 * 获取用户设置
 * GET /api/user-settings/:userId
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }

    // 开发环境中暂不验证用户权限，实际项目中应添加适当验证
    // const sessionUserId = req.session.userId;
    // if (userId !== sessionUserId && !isAdmin) {
    //   return res.status(403).json({ error: '无权访问此用户设置' });
    // }

    log(`[用户设置] 获取用户ID=${userId}的设置`);
    
    // 从数据库获取用户设置
    const settings = await storage.getUserSettings(userId);
    
    if (settings) {
      return res.json(settings);
    } else {
      // 返回默认设置
      return res.json({
        theme: 'system',
        font_size: 'medium',
        background_file: null
      });
    }
  } catch (error) {
    log(`[用户设置] 获取设置出错: ${error}`, 'error');
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

/**
 * 保存用户设置
 * POST /api/user-settings/:userId
 */
router.post('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = utils.safeParseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: '无效的用户ID' });
    }

    // 开发环境中暂不验证用户权限
    // const sessionUserId = req.session.userId;
    // if (userId !== sessionUserId && !isAdmin) {
    //   return res.status(403).json({ error: '无权修改此用户设置' });
    // }
    
    const { theme, font_size, background_file } = req.body;
    
    // 验证设置内容
    if (theme && !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: '无效的主题设置' });
    }
    
    if (font_size && !['small', 'medium', 'large'].includes(font_size)) {
      return res.status(400).json({ error: '无效的字体大小设置' });
    }
    
    // 验证背景图片文件ID (如果提供)
    if (background_file) {
      // 检查文件是否存在且属于该用户
      const fileExists = await storage.checkUserFileExists(userId, background_file);
      if (!fileExists) {
        log(`[用户设置] 警告: 文件ID=${background_file}不存在或不属于用户ID=${userId}`);
        // 我们不返回错误，而是记录警告并继续处理其他设置
      }
    }
    
    log(`[用户设置] 保存用户ID=${userId}的设置: theme=${theme}, font_size=${font_size}, background_file=${background_file || 'null'}`);
    
    // 保存到数据库
    const settings = await storage.saveUserSettings(userId, {
      theme,
      font_size,
      background_file
    });
    
    return res.json(settings);
  } catch (error) {
    log(`[用户设置] 保存设置出错: ${error}`, 'error');
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

export default router;
