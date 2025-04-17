/**
 * 系统配置路由
 * 处理系统配置的读取和更新
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';

const router = Router();

// 导入统一的管理员中间件
import { requireAdmin } from '../middleware/auth';

/**
 * 初始化默认系统配置
 * 这个函数会在模块加载时运行，确保系统配置始终存在
 */
async function initDefaultConfigs() {
  try {
    // 检查配置是否已存在
    const registrationConfig = await storage.getSystemConfig('registration_enabled');
    if (!registrationConfig) {
      // 创建默认配置
      await storage.upsertSystemConfig(
        'registration_enabled',
        'true',
        '是否允许新用户注册'
      );
      log('已创建默认注册配置');
    }

    const loginConfig = await storage.getSystemConfig('login_enabled');
    if (!loginConfig) {
      // 创建默认配置
      await storage.upsertSystemConfig(
        'login_enabled',
        'true',
        '是否允许用户登录'
      );
      log('已创建默认登录配置');
    }
  } catch (error) {
    log(`初始化默认系统配置错误: ${error}`);
  }
}

// 调用初始化函数
initDefaultConfigs();

/**
 * 获取所有系统配置
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // 注意：系统配置是公开的，不需要身份验证
    // 但是，可以根据需要添加身份验证
    const configs = await storage.getAllSystemConfigs();
    res.json(configs);
  } catch (error) {
    log(`获取系统配置错误: ${error}`);
    res.status(500).json({ error: '获取系统配置失败' });
  }
});

/**
 * 获取指定键的系统配置
 */
router.get('/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const config = await storage.getSystemConfig(key);
    
    if (!config) {
      return res.status(404).json({ error: '配置不存在' });
    }
    
    res.json(config);
  } catch (error) {
    log(`获取系统配置错误: ${error}`);
    res.status(500).json({ error: '获取系统配置失败' });
  }
});

/**
 * 更新或创建系统配置
 * 仅限管理员使用
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: '缺少必要的参数' });
    }
    
    const userId = req.session.userId || Number(req.query.userId);
    
    const config = await storage.upsertSystemConfig(
      key,
      value,
      description,
      userId
    );
    
    res.json(config);
  } catch (error) {
    log(`更新系统配置错误: ${error}`);
    res.status(500).json({ error: '更新系统配置失败' });
  }
});

export default router;