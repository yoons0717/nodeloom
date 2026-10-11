// 실제 Postgres 18 컨테이너로 끝난 실행 기록 정리를 확인한다.
import type { INestApplication } from '@nestjs/common';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaService } from '../prisma.service.js';
import { startTestApp } from '../test-app.test-util.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { QueueService } from './queue.js';
import type { RunCleanup } from './run-cleanup.js';

const DAY = 24 * 60 * 60_000;

describe('RunCleanup', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;
  let cleanup: RunCleanup;
  let queue: QueueService;
  let CLEANUP_QUEUE: string;

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
    const { PrismaService } = await import('../prisma.service.js');
    const { RunCleanup, CLEANUP_QUEUE: name } =
      await import('./run-cleanup.js');
    const { QueueService } = await import('./queue.js');
    prisma = app.get(PrismaService);
    cleanup = app.get(RunCleanup);
    queue = app.get(QueueService);
    CLEANUP_QUEUE = name;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('매일 03:00(APP_TIMEZONE)에 돌도록 등록한다', async () => {
    expect(await queue.boss.getSchedules(CLEANUP_QUEUE)).toMatchObject([
      { cron: '0 3 * * *', timezone: 'Asia/Seoul' },
    ]);
  });

  it('끝난 지 30일이 지난 실행만 지우고, 진행 중이거나 최근 실행은 남긴다', async () => {
    const { id: workflowId } = await prisma.workflow.create({
      data: { name: 'w', graph: {} },
    });
    const now = Date.now();
    const run = (status: 'SUCCESS' | 'FAILED' | 'RUNNING', ageDays: number) =>
      prisma.run.create({
        data: {
          workflowId,
          kind: 'MANUAL',
          status,
          graph: {},
          triggerInput: {},
          createdAt: new Date(now - ageDays * DAY),
          finishedAt:
            status === 'RUNNING' ? null : new Date(now - ageDays * DAY),
        },
      });
    const oldSuccess = await run('SUCCESS', 31);
    await run('FAILED', 31);
    const recent = await run('SUCCESS', 29);
    // 정리는 끝난 실행만 본다. 오래 멈춘 실행은 따로 FAILED로 끝낸다.
    const stuck = await run('RUNNING', 40);
    await prisma.nodeRun.create({
      data: {
        runId: oldSuccess.id,
        nodeId: 'n',
        nodeKey: 'n',
        attempt: 1,
        status: 'SUCCESS',
      },
    });

    await cleanup.handle();

    const left = await prisma.run.findMany({ where: { workflowId } });
    expect(left.map((r) => r.id).sort()).toEqual([recent.id, stuck.id].sort());
    expect(
      await prisma.nodeRun.count({ where: { runId: oldSuccess.id } }),
    ).toBe(0);
  });
});
