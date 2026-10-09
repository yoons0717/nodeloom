import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION, type Graph } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { PrismaService } from '../prisma.service.js';
import { startTestApp, TEST_PASSWORD } from '../test-app.test-util.js';

const graph: Graph = {
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes: [
    {
      id: 'trigger',
      key: 'trigger',
      type: 'trigger',
      title: 'Trigger',
      position: { x: 0, y: 0 },
      config: { testInput: { n: 1 } },
    },
    {
      id: 'plus',
      key: 'plus',
      type: 'transform',
      title: '더하기',
      position: { x: 0, y: 0 },
      config: { expression: 'n + 1' },
    },
  ],
  edges: [
    {
      id: 'e',
      from: { node: 'trigger', port: 'out' },
      to: { node: 'plus', port: 'in' },
    },
  ],
};

describe('실행 API', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  const create = async (g: Graph = graph) =>
    (
      (await agent.post('/workflows').send({ name: 'w', graph: g }).expect(201))
        .body as { id: string }
    ).id;
  const status = async (runId: string) =>
    (await agent.get(`/runs/${runId}/status`).expect(200)).body as {
      status: string;
      nodes: { nodeKey: string; status: string }[];
    };
  // 실행 중인 기록을 직접 넣는다(실제 실행은 금방 끝나서).
  const markRunning = (workflowId: string) =>
    prisma.run.create({
      data: {
        workflowId,
        kind: 'MANUAL',
        status: 'RUNNING',
        graph: {},
        triggerInput: {},
      },
    });

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
    const { PrismaService } = await import('../prisma.service.js');
    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ password: TEST_PASSWORD })
      .expect(204);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('실행하면 202와 runId를 돌려주고, 상태 조회로 끝까지 따라갈 수 있다', async () => {
    const id = await create();
    const { runId } = (await agent.post(`/workflows/${id}/runs`).expect(202))
      .body as { runId: string };

    await vi.waitFor(
      async () => expect((await status(runId)).status).toBe('SUCCESS'),
      { timeout: 10_000, interval: 200 },
    );
    const { nodes } = await status(runId);
    expect(nodes.map((n) => [n.nodeKey, n.status]).sort()).toEqual([
      ['plus', 'SUCCESS'],
      ['trigger', 'SUCCESS'],
    ]);
    // 입출력은 상태 조회에 넣지 않는다(DECISIONS B-1).
    expect(JSON.stringify(nodes)).not.toContain('output');
  });

  it('검사 오류가 있으면 422와 문제 목록, 이미 실행 중이면 409', async () => {
    const broken = await create({ ...graph, nodes: [], edges: [] });
    const res = await agent.post(`/workflows/${broken}/runs`).expect(422);
    expect(res.body).toMatchObject({
      issues: [{ code: 'trigger_count' }],
    });

    const id = await create();
    await markRunning(id);
    await agent.post(`/workflows/${id}/runs`).expect(409, {
      message: '이미 실행 중입니다',
      error: 'Conflict',
      statusCode: 409,
    });
  });

  it('실행 중이면 삭제를 거부하고, 끝나면 실행 기록과 함께 지운다', async () => {
    const id = await create();
    const run = await markRunning(id);
    await agent.delete(`/workflows/${id}`).expect(409);

    await prisma.run.update({
      where: { id: run.id },
      data: { status: 'SUCCESS' },
    });
    await agent.delete(`/workflows/${id}`).expect(204);
    expect(await prisma.run.count({ where: { workflowId: id } })).toBe(0);
  });

  it('실패 알림 워크플로우를 지정하고, 그 워크플로우를 지우면 설정이 비워진다', async () => {
    const id = await create();
    const alert = await create();
    await agent
      .patch(`/workflows/${id}/failure-workflow`)
      .send({ failureWorkflowId: alert })
      .expect(204);
    expect((await agent.get(`/workflows/${id}`)).body).toMatchObject({
      failureWorkflowId: alert,
    });

    await agent
      .patch(`/workflows/${id}/failure-workflow`)
      .send({ failureWorkflowId: '00000000-0000-4000-8000-000000000000' })
      .expect(422);

    await agent.delete(`/workflows/${alert}`).expect(204);
    expect((await agent.get(`/workflows/${id}`)).body).toMatchObject({
      failureWorkflowId: null,
    });
  });
});
