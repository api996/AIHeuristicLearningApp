/**
 * 身份验证中间件
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

/**
 * 检查用户是否已登录
 * 从会话或请求参数中获取用户ID
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    // 从会话中获取用户ID
    const sessionUserId = req.session?.userId;
    
    // 从查询参数或请求体中获取用户ID
    const queryUserId = req.query.userId || req.body?.userId;
    
    // 如果会话中有用户ID或请求中提供了用户ID，则认为已登录
    if (sessionUserId || queryUserId) {
      // 将用户ID添加到请求对象中，以便后续处理
      req.body = req.body || {};
      req.body.userId = sessionUserId || queryUserId;
      
      return next();
    }
    
    // 没有用户ID，返回401未授权错误
    return res.status(401).json({ error: '请先登录' });
  } catch (error) {
    log(`身份验证中间件错误: ${error}`);
    return res.status(500).json({ error: '身份验证失败' });
  }
}

/**
 * 检查用户是否为管理员
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // 从会话中获取用户角色
    const userRole = req.session?.role;
    
    // 从查询参数或请求体中获取用户角色
    const queryRole = req.query.role || req.body?.role;
    
    // 检查是否为管理员角色
    if (userRole === 'admin' || queryRole === 'admin') {
      return next();
    }
    
    // 不是管理员，返回403禁止访问错误
    return res.status(403).json({ error: '需要管理员权限' });
  } catch (error) {
    log(`管理员权限检查错误: ${error}`);
    return res.status(500).json({ error: '权限检查失败' });
  }
}

/**
 * 需要管理员权限的中间件
 * 这是一个备用名称，与isAdmin功能相同
 */
export const requireAdmin = isAdmin;