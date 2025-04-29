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
        background_file: null,
        primary_color: '#0deae4',  // 默认青色
        background_style: 'blur',  // 默认模糊背景
        ui_radius: 8               // 默认圆角度
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
    
    const { theme, font_size, background_file, primary_color, background_style, ui_radius } = req.body;
    
    // 验证设置内容
    if (theme && !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ error: '无效的主题设置' });
    }
    
    if (font_size && !['small', 'medium', 'large'].includes(font_size)) {
      return res.status(400).json({ error: '无效的字体大小设置' });
    }
    
    // 验证颜色格式
    if (primary_color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(primary_color)) {
      return res.status(400).json({ error: '无效的主题颜色格式' });
    }
    
    // 验证背景样式
    if (background_style && !['blur', 'solid', 'transparent'].includes(background_style)) {
      return res.status(400).json({ error: '无效的背景样式设置' });
    }
    
    // 验证圆角数值
    if (ui_radius !== undefined && (isNaN(Number(ui_radius)) || Number(ui_radius) < 0 || Number(ui_radius) > 20)) {
      return res.status(400).json({ error: '无效的圆角设置，应为0-20之间的数字' });
    }
    
    // 验证背景图片文件ID (如果提供)
    if (background_file && background_file !== 'null') {
      // 查询用户文件记录
      try {
        // 先尝试直接检查文件ID是否存在
        let fileExists = await storage.checkUserFileExists(userId, background_file);
        
        // 如果文件ID不存在，尝试作为标准图片名检查
        if (!fileExists && (background_file === 'portrait-background.jpg' || background_file === 'landscape-background.jpg' || 
                        background_file === 'mobile-background.jpg' || background_file === 'default-background.jpg')) {
          log(`[用户设置] 使用默认背景图片: ${background_file}`);
          // 默认背景图片总是有效的
          fileExists = true;
        }
        
        if (!fileExists) {
          log(`[用户设置] 警告: 文件ID=${background_file}不存在或不属于用户ID=${userId}`);
          // 列出用户的背景图片供调试
          const userFiles = await storage.getUserFiles(userId, 'background');
          log(`[用户设置] 用户可用背景图片: ${JSON.stringify(userFiles.map(f => ({ id: f.id, fileId: f.fileId, name: f.originalName })))}`); 
        }
      } catch (error) {
        log(`[用户设置] 检查背景图片出错: ${error}`, 'warn');
        // 继续处理其他设置
      }
    }
    
    // 更全面的日志记录，包含所有设置项
    log(`[用户设置] 保存用户ID=${userId}的设置: 
      theme=${theme || 'unchanged'}, 
      font_size=${font_size || 'unchanged'}, 
      background_file=${background_file || 'unchanged'}, 
      primary_color=${primary_color || 'unchanged'}, 
      background_style=${background_style || 'unchanged'}, 
      ui_radius=${ui_radius !== undefined ? ui_radius : 'unchanged'}
    `);
    
    // 保存到数据库 - 添加新字段
    const settings = await storage.saveUserSettings(userId, {
      theme,
      font_size,
      background_file,
      primary_color,
      background_style,
      ui_radius: ui_radius !== undefined ? Number(ui_radius) : undefined
    });
    
    return res.json(settings);
  } catch (error) {
    log(`[用户设置] 保存设置出错: ${error}`, 'error');
    return res.status(500).json({ error: utils.sanitizeErrorMessage(error) });
  }
});

export default router;
