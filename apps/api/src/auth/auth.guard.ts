import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { env } from '../env.js';
import { IS_PUBLIC } from './public.decorator.js';
import { SESSION_COOKIE, type SessionUser } from './session.js';

export type AuthedRequest = Request & { user?: SessionUser };

// 앱 전체에 거는 인증 Guard. 새 경로를 만들 때 보호를 잊어도 기본으로 막힌다.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    // 데모 서버는 쿠키 없이 공용 demo 사용자로 본다(DECISIONS B-6).
    if (env.DEMO_MODE) {
      req.user = { role: 'demo' };
      return true;
    }

    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string')
      throw new UnauthorizedException('로그인이 필요합니다');
    try {
      req.user = await this.jwt.verifyAsync<SessionUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException(
        '로그인이 만료되었습니다. 다시 로그인하세요',
      );
    }
  }
}
