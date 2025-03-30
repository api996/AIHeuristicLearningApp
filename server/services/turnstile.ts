import fetch from 'node-fetch';
import { log } from '../vite';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes': string[];
  challenge_ts: string;
  hostname: string;
  action: string;
  cdata: string;
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    log('[Turnstile] Attempting to verify token');
    
    const formData = new URLSearchParams();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    formData.append('response', token);

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

    const data = await response.json() as TurnstileVerifyResponse;
    
    log(`[Turnstile] Verification response: ${JSON.stringify(data)}`);

    if (!data.success) {
      log(`[Turnstile] Verification failed with errors: ${data['error-codes'].join(', ')}`);
      return false;
    }

    log('[Turnstile] Verification successful');
    return true;
  } catch (error) {
    log(`[Turnstile] Verification error: ${error}`);
    return false;
  }
}
