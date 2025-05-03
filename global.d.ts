import 'express-session';

declare module 'express-session' {
  interface SessionData {
    developerModeVerified?: boolean;
    userId?: number;
    userRole?: string;
    views?: number;
    // 为终端会话添加其他字段
    lastActive?: number;
    deviceInfo?: {
      userAgent?: string;
      ip?: string;
      device?: string;
    };
  }
}