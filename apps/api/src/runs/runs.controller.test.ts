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
  describe('실행 기록', () => {
    const run = async (id: string) => {
      const { runId } = (await agent.post(`/workflows/${id}/runs`).expect(202))
        .body as { runId: string };
      await vi.waitFor(
        async () => expect((await status(runId)).status).toBe('SUCCESS'),
        { timeout: 10_000, interval: 200 },
      );
      return runId;
    };

    it('목록은 최근 실행부터 입출력 없이 돌려준다', async () => {
      const id = await create();
      const first = await run(id);
      const second = await run(id);
      const res = await agent.get(`/workflows/${id}/runs`).expect(200);
      expect(res.body).toMatchObject([
        { id: second, status: 'SUCCESS', kind: 'MANUAL' },
        { id: first },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('graph');
      await agent
        .get('/workflows/00000000-0000-0000-0000-000000000000/runs')
        .expect(404);
    });

    it('상세는 실행 당시 그래프와 노드별 상태를 돌려준다', async () => {
      const id = await create();
      const runId = await run(id);
      // 실행 뒤에 워크플로우를 고쳐도 상세는 실행 당시 그래프다.
      await agent
        .put(`/workflows/${id}`)
        .send({ name: 'w', graph: { ...graph, nodes: [graph.nodes[0]] } })
        .expect(204);
      const res = await agent.get(`/runs/${runId}`).expect(200);
      expect(res.body).toMatchObject({
        id: runId,
        workflowId: id,
        status: 'SUCCESS',
        graph,
      });
      const { nodes } = res.body as { nodes: { nodeKey: string }[] };
      expect(nodes.map((n) => n.nodeKey).sort()).toEqual(['plus', 'trigger']);
      expect(JSON.stringify(nodes)).not.toContain('output');
      await agent.get('/runs/00000000-0000-0000-0000-000000000000').expect(404);
    });

    it('노드 입출력은 노드를 골랐을 때 시도별로 돌려준다', async () => {
      const id = await create();
      const runId = await run(id);
      const res = await agent.get(`/runs/${runId}/nodes/plus`).expect(200);
      expect(res.body).toMatchObject([
        { attempt: 1, status: 'SUCCESS', input: { n: 1 }, output: 2 },
      ]);
      await agent.get(`/runs/${runId}/nodes/ghost`).expect(404);
    });
    it('워크플로우 목록에 마지막 실행과 24시간 안의 실패 수를 함께 돌려준다', async () => {
      const id = await create();
      const none = await create();
      const failed = (finishedAt: Date) =>
        prisma.run.create({
          data: {
            workflowId: id,
            kind: 'MANUAL',
            status: 'FAILED',
            graph: {},
            triggerInput: {},
            finishedAt,
          },
        });
      await failed(new Date());
      await failed(new Date(Date.now() - 25 * 60 * 60_000));
      // 실패 뒤에 성공해도 실패 수는 남는다.
      await run(id);
      const rows = (await agent.get('/workflows').expect(200)).body as {
        id: string;
        lastRun: { status: string } | null;
        failedLast24h: number;
      }[];
      expect(rows.find((w) => w.id === id)).toMatchObject({
        lastRun: { status: 'SUCCESS' },
        failedLast24h: 1,
      });
      expect(rows.find((w) => w.id === none)).toMatchObject({
        lastRun: null,
        failedLast24h: 0,
      });
    });

    it('워크플로우의 실행 기록도 상태로 거르고, 오래된 실패도 찾는다', async () => {
      const id = await create();
      await prisma.run.create({
        data: {
          workflowId: id,
          kind: 'SCHEDULE',
          status: 'FAILED',
          graph: {},
          triggerInput: {},
          finishedAt: new Date(),
        },
      });
      await run(id);
      const statuses = async (q: string) =>
        (
          (await agent.get(`/workflows/${id}/runs${q}`).expect(200)).body as {
            status: string;
          }[]
        ).map((r) => r.status);
      expect(await statuses('?status=failed')).toEqual(['FAILED']);
      expect(await statuses('?status=success')).toEqual(['SUCCESS']);
      expect(await statuses('')).toEqual(['SUCCESS', 'FAILED']);
    });

    it('모든 실행 목록은 워크플로우 이름과 함께 최근 순이고, 상태로 거른다', async () => {
      const ok = await create();
      await agent
        .put(`/workflows/${ok}`)
        .send({ name: '성공 흐름', graph })
        .expect(204);
      const okRun = await run(ok);
      const bad = await create();
      await agent
        .put(`/workflows/${bad}`)
        .send({ name: '실패 흐름', graph })
        .expect(204);
      const badRun = await prisma.run.create({
        data: {
          workflowId: bad,
          kind: 'SCHEDULE',
          status: 'FAILED',
          graph: {},
          triggerInput: {},
          finishedAt: new Date(),
        },
      });

      const all = (await agent.get('/runs').expect(200)).body as {
        id: string;
        workflow: { id: string; name: string };
      }[];
      expect(all.slice(0, 2)).toMatchObject([
        { id: badRun.id, workflow: { id: bad, name: '실패 흐름' } },
        { id: okRun, workflow: { id: ok, name: '성공 흐름' } },
      ]);
      const failed = (await agent.get('/runs?status=failed').expect(200))
        .body as { status: string }[];
      expect(failed.every((r) => r.status === 'FAILED')).toBe(true);
      expect(JSON.stringify(all)).not.toContain('graph');
    });

    it('요약은 24시간 안에 실패한 수와 아직 끝나지 않은 수를 돌려준다', async () => {
      type Summary = { failedLast24h: number; running: number };
      const before = (await agent.get('/runs/summary').expect(200))
        .body as Summary;
      const id = await create();
      const failed = (finishedAt: Date) =>
        prisma.run.create({
          data: {
            workflowId: id,
            kind: 'MANUAL',
            status: 'FAILED',
            graph: {},
            triggerInput: {},
            finishedAt,
          },
        });
      await failed(new Date());
      await failed(new Date(Date.now() - 25 * 60 * 60_000));
      await markRunning(id);
      const after = (await agent.get('/runs/summary').expect(200))
        .body as Summary;
      expect(after.failedLast24h - before.failedLast24h).toBe(1);
      expect(after.running - before.running).toBe(1);
    });
  });
});
