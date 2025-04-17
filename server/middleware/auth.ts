/**
 * 身份验证中间件
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { storage } from '../storage';

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
    }
  }
}

// 要求用户已登录
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从session获取用户ID
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    // 获取用户信息
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 将用户信息附加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user'
    };
    
    next();
  } catch (error) {
    log(`身份验证错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '身份验证失败'
    });
  }
};

// 要求用户具有管理员权限
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从session或query参数获取用户ID
    const userId = req.session?.userId || (req.query.userId ? Number(req.query.userId) : undefined);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    
    // 获取用户信息
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 将用户信息附加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user'
    };
    
    // 系统中ID为1的用户被视为管理员，无论其角色设置
    if (user.id === 1 || user.role === 'admin') {
      // 用户具有管理员权限
      return next();
    }
    
    // 其他用户没有管理员权限
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  } catch (error) {
    log(`管理员权限验证错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '权限验证失败'
    });
  }
};