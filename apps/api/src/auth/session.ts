import type { CookieOptions } from 'express';
import { env } from '../env.js';

export const SESSION_COOKIE = 'nodeloom_session';
export const SESSION_DAYS = 7;

export type Role = 'admin' | 'demo';
export type SessionUser = { role: Role };

// JavaScript가 읽지 못하고(httpOnly), 다른 사이트의 요청에는 붙지 않는다(Lax). 운영에서는 HTTPS로만 보낸다(DECISIONS 6-4).
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};
