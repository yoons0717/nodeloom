import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { DEMO_LIMITS } from './demo-limits.js';
import { env } from './env.js';
import { ExecutorModule } from './executor/executor.module.js';
import { HealthController } from './health.controller.js';
import { MockModule } from './mock/mock.module.js';
import { PrismaModule } from './prisma.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';

@Module({
  imports: [
    // 전체 API 속도 제한은 데모 서버에만 둔다(DECISIONS 8-3). 로그인은 경로에서 따로 더 좁힌다.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: env.DEMO_MODE
          ? DEMO_LIMITS.requestsPerMinute
          : Number.MAX_SAFE_INTEGER,
      },
    ]),
    PrismaModule,
    AuthModule,
    WorkflowsModule,
    ExecutorModule,
    MockModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
