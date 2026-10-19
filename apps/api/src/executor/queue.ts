import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type Graph, isValidCron } from '@nodeloom/core';
import { type Clock, fromPrisma, PgBoss } from 'pg-boss';
import { env } from '../env.js';
import { Prisma, type RunKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { PG_BOSS_CLOCK } from './pg-boss-clock.js';

// job 하나 = 실행 하나(DECISIONS 7-1)
export const RUN_QUEUE = 'run';
export type RunJob = { runId: string };
// 시도 횟수(pg-boss 기본 재시도 2번)를 다 쓴 실행 job이 옮겨 가는 큐. 남은 RUNNING을 FAILED로 끝낸다(M5 작은 결정 ⑤).
export const RUN_DEAD_QUEUE = 'run-dead';
const HEARTBEAT_SECONDS = 30;
// 스케줄 하나 = 워크플로우 하나. 키는 워크플로우 id
export const SCHEDULE_QUEUE = 'schedule';
export type ScheduleJob = { workflowId: string };
type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

// pg-boss는 앱과 같은 DB의 pgboss 스키마에 대기열 테이블을 만든다(DECISIONS 6-3). 워커도 같은 프로세스에서 돈다(7-6).
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  readonly boss: PgBoss;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PG_BOSS_CLOCK) readonly clock: Clock,
  ) {
    this.boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: 'pgboss',
      // 데모에서는 스케줄을 돌리지 않는다(DECISIONS D-3).
      schedule: !env.DEMO_MODE,
      clock,
    });
    // 'error' 이벤트를 받는 곳이 없으면 프로세스가 죽는다.
    this.boss.on('error', (err) => this.logger.error(err));
  }

  async onModuleInit() {
    await this.boss.start();
    await this.boss.createQueue(RUN_DEAD_QUEUE);
    await this.boss.createQueue(RUN_QUEUE);
    await this.boss.createQueue(SCHEDULE_QUEUE);
  }

  async onModuleDestroy() {
    await this.boss.stop();
  }

  // 저장·삭제와 같은 트랜잭션에서 Trigger의 cron대로 스케줄을 등록하거나 해제한다(DECISIONS B-5).
  // 그래프가 없거나(삭제) cron이 없거나 틀리면 해제한다. 다른 검사 오류는 실행할 때 FAILED로 남긴다(7-5).
  // missed: 'once'는 cron 확인이 한동안 멈췄다 돌아왔을 때 놓친 회차 중 가장 최근 하나를 늦게라도 보낸다.
  // 잠자기 뒤 깨어난 직후에는 DB 시계가 밀려 있다가 바로잡혀 회차를 건너뛸 수 있다(M10 10-c).
  async syncSchedule(tx: Tx, workflowId: string, graph: Graph | null) {
    if (env.DEMO_MODE) return;
    const db = fromPrisma(tx);
    const cron = graph?.nodes.find((n) => n.type === 'trigger')?.config.cron;
    if (typeof cron === 'string' && isValidCron(cron)) {
      await this.boss.schedule(
        SCHEDULE_QUEUE,
        cron,
        { workflowId } satisfies ScheduleJob,
        { key: workflowId, tz: env.APP_TIMEZONE, missed: 'once', db },
      );
    } else {
      await this.boss.unschedule(SCHEDULE_QUEUE, workflowId, { db });
    }
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
          deadLetter: RUN_DEAD_QUEUE,
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
