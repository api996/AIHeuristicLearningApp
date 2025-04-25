/**
 * 身份验证中间件
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { storage } from '../storage';

// 扩展Request接口以包含用户信息和路由类型标记
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
      };
      // 标记是否为管理员路由，用于条件性跳过某些服务
      isAdminRoute?: boolean;
    }
  }
}

// 要求用户已登录
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从session获取用户ID，如果不存在则尝试从query参数获取
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
    
    // 获取用户信息 - 只获取最基本的字段
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
    
    // 标记此请求为管理员路由，避免触发其他非必要服务
    req.isAdminRoute = true;
    
    // 增强的管理员验证逻辑
    const isSpecialAdmin = user.id === 1; // ID为1的用户始终是管理员
    const isRoleAdmin = user.role === 'admin'; // 角色为admin的用户
    
    // 检查管理员配置 - 如果环境变量定义了特定管理员用户
    const configuredAdminUsers = process.env.ADMIN_USERS ? process.env.ADMIN_USERS.split(',').map(id => Number(id.trim())) : [];
    const isConfigAdmin = configuredAdminUsers.includes(user.id);
    
    // 如果用户满足任何一个管理员条件，则允许访问
    if (isSpecialAdmin || isRoleAdmin || isConfigAdmin) {
      log(`管理员验证通过: userId=${user.id}, username=${user.username}, 验证方式: ${isSpecialAdmin ? 'ID=1' : (isRoleAdmin ? 'role=admin' : 'configuredAdmin')}`);
      return next();
    }
    
    // 其他用户没有管理员权限
    log(`管理员验证失败: userId=${user.id}, username=${user.username}, role=${user.role}`);
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