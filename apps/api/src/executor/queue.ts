import {
  ConflictException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Graph } from '@nodeloom/core';
import { fromPrisma, PgBoss } from 'pg-boss';
import { env } from '../env.js';
import { Prisma, type RunKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';

// job 하나 = 실행 하나(DECISIONS 7-1)
export const RUN_QUEUE = 'run';
export type RunJob = { runId: string };
const HEARTBEAT_SECONDS = 30;

// pg-boss는 앱과 같은 DB의 pgboss 스키마에 대기열 테이블을 만든다(DECISIONS 6-3). 워커도 같은 프로세스에서 돈다(7-6).
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  readonly boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
  });

  constructor(private readonly prisma: PrismaService) {
    // 'error' 이벤트를 받는 곳이 없으면 프로세스가 죽는다.
    this.boss.on('error', (err) => this.logger.error(err));
  }

  async onModuleInit() {
    await this.boss.start();
    await this.boss.createQueue(RUN_QUEUE);
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  // 실행 기록과 job을 한 트랜잭션으로 만든다. 하나가 실패하면 둘 다 남지 않는다(DECISIONS 6-3).
  async enqueueRun(input: {
    workflowId: string;
    kind: RunKind;
    graph: Graph;
    triggerInput: Prisma.InputJsonValue;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await tx.run.create({
          data: { ...input, graph: input.graph as Prisma.InputJsonObject },
        });
        await this.boss.send(RUN_QUEUE, { runId: run.id } satisfies RunJob, {
          db: fromPrisma(tx),
          // 워커가 죽으면 heartbeat가 끊기고, pg-boss가 job을 다시 꺼내 이어서 실행한다(M4 작은 결정 ③).
          heartbeatSeconds: HEARTBEAT_SECONDS,
          expireInSeconds: env.RUN_TIMEOUT + 60,
        });
        return run.id;
      });
    } catch (e) {
      // 부분 유니크 인덱스(runs_one_active_per_workflow)에 걸림 = 이미 실행 중(DECISIONS 7-5)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('이미 실행 중입니다');
      }
      throw e;
    }
  }
}
