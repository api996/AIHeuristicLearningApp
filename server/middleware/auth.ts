/**
 * 身份验证中间件
 */
import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';
import { storage } from '../storage';

// 添加cookies到Request类型
declare global {
  namespace Express {
    interface Request {
      cookies?: {
        [key: string]: string;
      };
    }
  }
}

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

// 从各种可能的来源获取用户ID 
const getUserIdFromRequest = (req: Request): number | undefined => {
  // 尝试从会话获取用户ID (主要认证来源)
  if (req.session?.userId) {
    return Number(req.session.userId);
  }
  
  // 从cookie获取用户ID (自动会话恢复机制)
  if (req.cookies && req.cookies.userId) {
    const userId = Number(req.cookies.userId);
    if (!isNaN(userId) && userId > 0) {
      // 如果从cookie获取到有效的userId，提示在日志中
      log(`[Auth] 从cookie恢复用户ID: ${userId} (路径: ${req.method} ${req.path})`);
      return userId;
    }
  }
  
  // 从查询参数获取用户ID (用于某些特定场景)
  if (req.query.userId) {
    const userId = Number(req.query.userId);
    if (!isNaN(userId) && userId > 0) {
      return userId;
    }
  }
  
  // 从请求头获取用户ID (用于API集成)
  const authHeader = req.headers['x-user-id'] || req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string') {
    // 支持两种格式: 直接数字ID 或 'Bearer USER_ID' 格式
    const userId = authHeader.startsWith('Bearer ') 
      ? Number(authHeader.substring(7)) 
      : Number(authHeader);
      
    if (!isNaN(userId) && userId > 0) {
      return userId;
    }
  }
  
  // 尝试从URL路径参数中获取用户ID (某些路由使用/users/:userId格式)
  if (req.params && req.params.userId) {
    const userId = Number(req.params.userId);
    if (!isNaN(userId) && userId > 0) {
      return userId;
    }
  }
  
  return undefined;
};

// 要求用户已登录
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从各种可能的来源获取用户ID
    const userId = getUserIdFromRequest(req);
    
    // 记录详细的请求认证信息，帮助调试
    const path = req.path;
    const method = req.method;
    
    if (!userId) {
      // 仅记录API请求的认证失败
      if (path.startsWith('/api/') && !path.includes('/api/login') && !path.includes('/api/register')) {
        log(`[Auth] 认证失败 - 用户ID未找到: ${method} ${path}`);
      }
      
      return res.status(401).json({
        success: false,
        message: '请先登录',
        redirectTo: '/login'
      });
    }
    
    // 获取用户信息
    const user = await storage.getUser(userId);
    if (!user) {
      // 如果会话中的用户ID无效，清除会话数据
      if (req.session?.userId) {
        log(`[Auth] 会话中的用户ID(${userId})无效，清除会话`);
        req.session.userId = undefined;
        req.session.destroy((err) => {
          if (err) {
            log(`[Auth] 清除会话失败: ${err}`);
          }
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '用户不存在或会话已过期',
        redirectTo: '/login'
      });
    }
    
    // 如果用户ID来自查询参数或其他非会话来源，将其添加到会话中
    // 这样可以在后续请求中自动使用会话而不需要查询参数
    if ((!req.session.userId || req.session.userId !== userId) && userId) {
      // 确保会话存在并可以正常设置
      if (req.session) {
        req.session.userId = userId;
        
        // 刷新会话以确保更改被保存
        req.session.save((err) => {
          if (err) {
            log(`[Auth] 保存会话时出错: ${err}`);
          } else {
            log(`[Auth] 会话已更新，用户ID: ${userId}`);
          }
        });
        
        // 添加额外的cookie，用于会话恢复和客户端识别，7天有效期
        res.cookie('userId', userId.toString(), {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
        
        // 记录日志，标记为会话恢复
        log(`[Auth] 用户ID(${userId})已添加到会话并设置cookie, 路径: ${method} ${path}`);
        
        // 保存用户角色到会话，便于某些不需要查询数据库的检查
        req.session.userRole = user.role || 'user';
      } else {
        log(`[Auth警告] 尝试将用户ID(${userId})添加到会话，但会话对象不存在`);
      }
    }
    
    // 将用户信息附加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user'
    };
    
    // 在生产环境记录关键操作的验证通过
    if (process.env.NODE_ENV === 'production' && 
        (path.includes('/admin') || path.includes('/delete') || method === 'DELETE')) {
      log(`[Auth] 敏感操作验证通过: ${method} ${path}, userId=${user.id}, username=${user.username}`);
    }
    
    next();
  } catch (error) {
    log(`[Auth] 身份验证错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '身份验证失败，请重新登录',
      redirectTo: '/login'
    });
  }
};

// 要求用户具有管理员权限
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 使用相同的getUserIdFromRequest函数获取用户ID
    const userId = getUserIdFromRequest(req);
    
    // 记录详细的请求认证信息，帮助调试
    const path = req.path;
    const method = req.method;
    
    if (!userId) {
      // 记录管理员认证失败
      log(`[AdminAuth] 认证失败 - 用户ID未找到: ${method} ${path}`);
      
      return res.status(401).json({
        success: false,
        message: '请先登录',
        redirectTo: '/login'
      });
    }
    
    // 获取用户信息
    const user = await storage.getUser(userId);
    if (!user) {
      // 如果会话中的用户ID无效，清除会话数据
      if (req.session?.userId) {
        log(`[AdminAuth] 会话中的用户ID(${userId})无效，清除会话`);
        req.session.userId = undefined;
        req.session.destroy((err) => {
          if (err) {
            log(`[AdminAuth] 清除会话失败: ${err}`);
          }
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '用户不存在或会话已过期',
        redirectTo: '/login'
      });
    }
    
    // 如果用户ID来自查询参数或其他非会话来源，将其添加到会话中
    if ((!req.session.userId || req.session.userId !== userId) && userId) {
      // 确保会话存在并可以正常设置
      if (req.session) {
        req.session.userId = userId;
        
        // 刷新会话以确保更改被保存
        req.session.save((err) => {
          if (err) {
            log(`[AdminAuth] 保存会话时出错: ${err}`);
          } else {
            log(`[AdminAuth] 会话已更新，用户ID: ${userId}`);
          }
        });
        
        // 添加额外的cookie，用于会话恢复和客户端识别，7天有效期
        res.cookie('userId', userId.toString(), {
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production'
        });
        
        // 记录日志，标记为会话恢复
        log(`[AdminAuth] 用户ID(${userId})已添加到会话并设置cookie, 路径: ${method} ${path}`);
        
        // 保存用户角色到会话，便于某些不需要查询数据库的检查
        req.session.userRole = user.role || 'user';
      } else {
        log(`[AdminAuth警告] 尝试将用户ID(${userId})添加到会话，但会话对象不存在`);
      }
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
      log(`[AdminAuth] 管理员验证通过: userId=${user.id}, username=${user.username}, 验证方式: ${
        isSpecialAdmin ? 'ID=1' : (isRoleAdmin ? 'role=admin' : 'configuredAdmin')
      }, 路径: ${method} ${path}`);
      return next();
    }
    
    // 其他用户没有管理员权限
    log(`[AdminAuth] 管理员验证失败: userId=${user.id}, username=${user.username}, role=${user.role}, 路径: ${method} ${path}`);
    return res.status(403).json({
      success: false,
      message: '需要管理员权限',
      redirectTo: '/'
    });
  } catch (error) {
    log(`[AdminAuth] 管理员权限验证错误: ${error}`);
    res.status(500).json({
      success: false,
      message: '权限验证失败',
      redirectTo: '/login'
    });
  }
};