import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION, type Graph } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaService } from '../prisma.service.js';
import { startTestApp } from '../test-app.test-util.js';
import { QueueService, RUN_QUEUE, type RunJob } from './queue.js';

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
  const enqueue = (kind: 'MANUAL' | 'SCHEDULE' | 'FAILURE') =>
    queue.enqueueRun({ workflowId, kind, graph, triggerInput: {} });
  const jobs = () => queue.boss.fetch<RunJob>(RUN_QUEUE, { batchSize: 10 });

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
    queue = app.get(QueueService);
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    workflowId = (
      await prisma.workflow.create({ data: { name: 'w', graph: {} } })
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
});
