import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION, type Graph } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaService } from '../prisma.service.js';
import { startTestApp } from '../test-app.test-util.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { QueueService, RunJob } from './queue.js';

const graph: Graph = {
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes: [],
  edges: [],
};

describe('실행 대기열', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let queue: QueueService;
  let prisma: PrismaService;
  let workflowId: string;
  let RUN_QUEUE: string;
  let SCHEDULE_QUEUE: string;
  const enqueue = (kind: 'MANUAL' | 'SCHEDULE' | 'FAILURE') =>
    queue.enqueueRun({ workflowId, kind, graph, triggerInput: {} });
  const jobs = () => queue.boss.fetch<RunJob>(RUN_QUEUE, { batchSize: 10 });

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
    const { QueueService } = await import('./queue.js');
    ({ RUN_QUEUE, SCHEDULE_QUEUE } = await import('./queue.js'));
    const { PrismaService } = await import('../prisma.service.js');
    queue = app.get(QueueService);
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    workflowId = (
      await prisma.workflow.create({
        data: { name: `w-${randomUUID()}`, graph: {} },
      })
    ).id;
  });

  it('대기·실행 중인 기록은 워크플로우당 하나다. 실패 알림 실행은 예외', async () => {
    const first = await enqueue('MANUAL');
    await expect(enqueue('SCHEDULE')).rejects.toMatchObject({ status: 409 });
    await enqueue('FAILURE');

    await prisma.run.update({
      where: { id: first },
      data: { status: 'SUCCESS' },
    });
    await enqueue('MANUAL');

    expect(await prisma.run.count({ where: { workflowId } })).toBe(3);
  });

  it('실행 기록과 job은 함께 만들어지고, job 등록이 실패하면 둘 다 남지 않는다', async () => {
    await jobs(); // 앞 테스트의 job 비우기
    const runId = await enqueue('MANUAL');
    expect((await jobs()).map((j) => j.data)).toEqual([{ runId }]);

    // job이 트랜잭션 안에 들어간 뒤 실패하는 경우
    await prisma.run.deleteMany({ where: { workflowId } });
    const send = queue.boss.send.bind(queue.boss);
    vi.spyOn(queue.boss, 'send').mockImplementationOnce(async (...args) => {
      await send(...args);
      throw new Error('job 등록 실패');
    });
    await expect(enqueue('MANUAL')).rejects.toThrow('job 등록 실패');

    expect(await prisma.run.count({ where: { workflowId } })).toBe(0);
    expect(await jobs()).toEqual([]);
  });
  it('스케줄 등록은 트랜잭션을 따라 함께 되돌아간다', async () => {
    const withCron = {
      ...graph,
      nodes: [
        {
          id: 't',
          key: 'trigger_1',
          type: 'trigger' as const,
          title: '',
          position: { x: 0, y: 0 },
          config: { cron: '0 7 * * *' },
        },
      ],
    };
    await expect(
      prisma.$transaction(async (tx) => {
        await queue.syncSchedule(tx, workflowId, withCron);
        throw new Error('저장 실패');
      }),
    ).rejects.toThrow('저장 실패');
    expect(await queue.boss.getSchedules(SCHEDULE_QUEUE, workflowId)).toEqual(
      [],
    );
  });
});
