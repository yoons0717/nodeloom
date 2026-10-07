import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import type { AuthedRequest } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionCookieOptions,
} from './session.js';

const loginSchema = z.object({
  password: z.string().min(1, { error: '비밀번호를 입력하세요' }),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // 비밀번호 대입을 늦추려고 IP당 1분에 5번까지만 받는다(DECISIONS 8-3, M3 작은 결정 ②).
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(204)
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: z.output<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.login(body.password);
    res.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions,
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return { role: req.user?.role };
  }
}
