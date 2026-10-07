import { randomBytes } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../env.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SESSION_DAYS } from './session.js';

@Module({
  imports: [
    JwtModule.register({
      // 데모 모드에는 서명 키가 없어도 된다. 로그인을 쓰지 않으므로 아무 키나 넣어 둔다.
      secret: env.JWT_SECRET ?? randomBytes(32).toString('hex'),
      signOptions: { expiresIn: `${SESSION_DAYS}d` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
