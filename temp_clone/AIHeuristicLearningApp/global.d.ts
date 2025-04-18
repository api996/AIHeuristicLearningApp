import 'express-session';

declare module 'express-session' {
  interface SessionData {
    developerModeVerified?: boolean;
    userId?: number;
  }
}