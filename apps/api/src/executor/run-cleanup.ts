import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { env } from '../env.js';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from './queue.js';

export const CLEANUP_QUEUE = 'cleanup';
const DAY_MS = 24 * 60 * 60_000;

// 끝난 실행 기록을 RUN_RETENTION_DAYS가 지나면 매일 지운다(DECISIONS A-6). node_runs는 cascade로 함께 지워진다.
@Injectable()
export class RunCleanup implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async onApplicationBootstrap() {
    // 데모에서는 정리 작업도 돌리지 않는다(DECISIONS D-3).
    if (env.DEMO_MODE) return;
    const { boss } = this.queue;
    await boss.createQueue(CLEANUP_QUEUE);
    await boss.schedule(CLEANUP_QUEUE, '0 3 * * *', null, {
      tz: env.APP_TIMEZONE,
    });
    await boss.work(CLEANUP_QUEUE, () => this.handle());
  }

  async handle() {
    const before = new Date(
      this.queue.clock.now() - env.RUN_RETENTION_DAYS * DAY_MS,
    );
    // finishedAt은 끝난 실행에만 있으므로 진행 중인 실행은 지우지 않는다.
    await this.prisma.run.deleteMany({ where: { finishedAt: { lt: before } } });
  }
}
