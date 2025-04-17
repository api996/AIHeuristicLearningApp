/**
 * 系统配置路由
 * 处理系统配置的读取和更新
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';

const router = Router();

// 检查用户是否为管理员的中间件
const isAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = req.session.userId || Number(req.query.userId);
    
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }
    
    const user = await storage.getUser(Number(userId));
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  } catch (error) {
    log(`管理员权限检查错误: ${error}`);
    res.status(500).json({ error: '服务器错误' });
  }
};

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
router.post('/', isAdmin, async (req: Request, res: Response) => {
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