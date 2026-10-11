// 실제 Postgres 18 컨테이너와 pg-boss 시험용 시계로 스케줄 워커를 확인한다.
import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION, type Graph } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { TestClock } from 'pg-boss';
import type { PrismaService } from '../prisma.service.js';
import { startTestApp } from '../test-app.test-util.js';
import { PG_BOSS_CLOCK } from './pg-boss-clock.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { WorkflowsService } from '../workflows/workflows.service.js';
import type { ScheduleWorker } from './schedule-worker.js';

const trigger = (cron: string | null) => ({
  id: 'trigger_1',
  key: 'trigger_1',
  type: 'trigger' as const,
  title: '',
  position: { x: 0, y: 0 },
  config: { cron },
});
const transform = (id: string) => ({
  id,
  key: id,
  type: 'transform' as const,
  title: '',
  position: { x: 0, y: 0 },
  config: { expression: '1' },
});
const flow = (cron: string | null): Graph => ({
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes: [trigger(cron), transform('msg_1')],
  edges: [
    {
      id: 'e',
      from: { node: 'trigger_1', port: 'out' },
      to: { node: 'msg_1', port: 'in' },
    },
  ],
});

// 서울 2026-10-12 06:59:30
const START = new Date('2026-10-11T21:59:30Z');

describe('ScheduleWorker', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;
  let workflows: WorkflowsService;
  let worker: ScheduleWorker;
  const clock = new TestClock(START);
  const runsOf = (workflowId: string) =>
    prisma.run.findMany({ where: { workflowId } });
  const save = async (graph: Graph) =>
    (await workflows.create({ name: 's', graph })).id;

  beforeAll(async () => {
    ({ app, container } = await startTestApp({}, (b) =>
      b.overrideProvider(PG_BOSS_CLOCK).useValue(clock),
    ));
    const { PrismaService } = await import('../prisma.service.js');
    const { WorkflowsService } =
      await import('../workflows/workflows.service.js');
    const { ScheduleWorker } = await import('./schedule-worker.js');
    prisma = app.get(PrismaService);
    workflows = app.get(WorkflowsService);
    worker = app.get(ScheduleWorker);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('cron 시각이 되면 스케줄 실행을 만든다', async () => {
    const id = await save(flow('0 7 * * *'));
    await clock.tick(20_000);
    expect(await runsOf(id)).toEqual([]);

    // 07:00을 지나 pg-boss가 회차를 보내고 워커가 꺼낼 때까지
    for (let i = 0; i < 20 && (await runsOf(id)).length === 0; i++) {
      await clock.tick(30_000);
    }
    expect(await runsOf(id)).toMatchObject([
      { kind: 'SCHEDULE', triggerInput: {} },
    ]);
  }, 60_000);

  it('검사 오류가 있으면 FAILED로 남기고 실패 알림을 실행한다', async () => {
    const alert = await save(flow(null));
    const g = flow('0 7 * * *');
    g.nodes.push(transform('orphan_1')); // Trigger에서 이어지지 않은 노드
    const id = await save(g);
    await prisma.workflow.update({
      where: { id },
      data: { failureWorkflowId: alert },
    });

    await worker.handle({ workflowId: id }, new Date(clock.now()));

    expect(await runsOf(id)).toMatchObject([
      {
        kind: 'SCHEDULE',
        status: 'FAILED',
        // 상세 화면이 무엇이 틀렸는지 보여 줄 수 있게 문제 목록도 남긴다.
        error: {
          code: 'INVALID_GRAPH',
          issues: [expect.objectContaining({ code: 'unreachable' })],
        },
      },
    ]);
    expect(await runsOf(alert)).toMatchObject([{ kind: 'FAILURE' }]);
  });

  it('이미 실행 중이면 이번 회차를 건너뛴다', async () => {
    const id = await save(flow('0 7 * * *'));
    await worker.handle({ workflowId: id }, new Date(clock.now()));
    await worker.handle({ workflowId: id }, new Date(clock.now()));
    expect(await runsOf(id)).toHaveLength(1);
  });

  it('오래된 회차와 지워진 워크플로우의 회차는 실행하지 않는다', async () => {
    const id = await save(flow('0 7 * * *'));
    await worker.handle(
      { workflowId: id },
      new Date(clock.now() - 10 * 60_000),
    );
    expect(await runsOf(id)).toEqual([]);

    await expect(
      worker.handle(
        { workflowId: '00000000-0000-0000-0000-000000000000' },
        new Date(clock.now()),
      ),
    ).resolves.toBeUndefined();
  });
});
