/**
 * 用户认证中间件
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

/**
 * 验证用户是否已登录
 */
export const requireLogin = (req: Request, res: Response, next: NextFunction) => {
  // 如果用户会话存在，则继续
  if (req.session && req.session.userId) {
    return next();
  }
  
  // 否则返回未授权错误
  res.status(401).json({ error: '请先登录' });
};

/**
 * 验证用户是否为管理员
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  // 确保用户已登录
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }
  
  // 验证userId参数
  const { userId } = req.body;
  
  // 如果提供了userId，确保它匹配会话中的userId，或者用户是管理员
  if (userId && parseInt(userId, 10) !== req.session.userId) {
    // 检查用户是否为管理员，这里简单实现 - 可以替换为数据库查询
    const isAdmin = req.session.role === 'admin';
    
    if (!isAdmin) {
      log(`非管理员用户 ${req.session.userId} 尝试以 ${userId} 身份访问管理功能`);
      return res.status(403).json({ error: '需要管理员权限' });
    }
  }
  
  // 用户已登录并且有适当的权限，继续
  next();
};

/**
 * 验证开发者模式
 */
export const requireDevMode = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.developerModeVerified) {
    return next();
  }

  res.status(403).json({ error: '需要开发者模式' });
};