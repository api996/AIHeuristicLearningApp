
import fetch from 'node-fetch';
import { log } from '../vite';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes': string[];
  challenge_ts: string;
  hostname: string;
  action: string;
  cdata: string;
  tokenId?: string;
  messages?: string[];
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    log('[Turnstile] 尝试验证令牌');
    
    if (!token || token.trim() === '') {
      log('[Turnstile] 令牌为空');
      return false;
    }

    // 获取密钥
    const secretKey = process.env.TURNSTILE_SECRET_KEY || '';
    if (!secretKey) {
      log('[Turnstile] 错误: 未设置 TURNSTILE_SECRET_KEY 环境变量');
      return false;
    }

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    // 添加可选的客户端IP (如果有)
    // formData.append('remoteip', remoteIp);

    log('[Turnstile] 发送请求到 Cloudflare Turnstile API');
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.ok) {
      log(`[Turnstile] API响应错误: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json() as TurnstileVerifyResponse;
    
    log(`[Turnstile] 验证响应: ${JSON.stringify(data)}`);

    if (!data.success) {
      const errors = data['error-codes'] ? data['error-codes'].join(', ') : '未知错误';
      log(`[Turnstile] 验证失败，错误: ${errors}`);
      
      // 处理特定错误
      if (data['error-codes'].includes('timeout-or-duplicate')) {
        log('[Turnstile] 令牌已过期或重复使用');
      }
      
      return false;
    }

    log('[Turnstile] 验证成功');
    return true;
  } catch (error) {
    log(`[Turnstile] 验证过程发生错误: ${error}`);
    return false;
  }
}
