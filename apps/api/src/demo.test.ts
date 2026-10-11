import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DEMO_LIMITS } from './demo-limits.js';
import { startTestApp } from './test-app.test-util.js';

const nodes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    key: `transform_${i}`,
    type: 'transform' as const,
    title: '',
    position: { x: 0, y: 0 },
    config: {},
  }));
const workflow = (nodeCount = 0) => ({
  name: '데모',
  graph: {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: nodes(nodeCount),
    edges: [],
  },
});

// 데모 서버 규칙(DECISIONS 6-5, B-6, 8-3)
describe('DEMO_MODE', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, container } = await startTestApp({
      DEMO_MODE: 'true',
      ADMIN_PASSWORD_HASH: '',
      JWT_SECRET: '',
    }));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('쿠키 없이 demo 사용자로 목록과 저장 API를 쓸 수 있다', async () => {
    await api().get('/workflows').expect(200);
    await api().post('/workflows').send(workflow(1)).expect(201);
    const me = await api().get('/auth/me').expect(200);
    expect(me.body).toEqual({ role: 'demo' });
  });

  it('관리자 로그인은 403이다', async () => {
    await api().post('/auth/login').send({ password: 'anything' }).expect(403);
  });

  it(`노드가 ${DEMO_LIMITS.nodesPerGraph}개를 넘는 그래프는 저장하지 않는다`, async () => {
    await api()
      .post('/workflows')
      .send(workflow(DEMO_LIMITS.nodesPerGraph + 1))
      .expect(403);
  });

  it('cron을 적어 저장해도, 기록 정리도 스케줄을 등록하지 않는다', async () => {
    const { QueueService, SCHEDULE_QUEUE } =
      await import('./executor/queue.js');
    const trigger = {
      id: 't',
      key: 'trigger_1',
      type: 'trigger',
      title: '',
      position: { x: 0, y: 0 },
      config: { cron: '* * * * *' },
    };
    const body = workflow(0);
    const res = await api()
      .post('/workflows')
      .send({ ...body, graph: { ...body.graph, nodes: [trigger] } })
      .expect(201);
    const id = (res.body as { id: string }).id;
    expect(
      await app.get(QueueService).boss.getSchedules(SCHEDULE_QUEUE, id),
    ).toEqual([]);
    const { CLEANUP_QUEUE } = await import('./executor/run-cleanup.js');
    expect(
      await app.get(QueueService).boss.getSchedules(CLEANUP_QUEUE),
    ).toEqual([]);
  });

  it('256KB를 넘는 요청은 413이다', async () => {
    const big = { ...workflow(1), name: 'x' };
    const res = await api()
      .post('/workflows')
      .send({ ...big, padding: 'x'.repeat(300 * 1024) });
    expect(res.status).toBe(413);
  });

  it(`워크플로우가 ${DEMO_LIMITS.workflows}개가 되면 더 만들 수 없다`, async () => {
    const existing = ((await api().get('/workflows')).body as unknown[]).length;
    for (let i = existing; i < DEMO_LIMITS.workflows; i++) {
      await api().post('/workflows').send(workflow()).expect(201);
    }
    await api().post('/workflows').send(workflow()).expect(403);
  });

  // 속도 제한은 이 파일의 다른 요청에도 영향을 주므로 마지막에 둔다.
  it(`같은 IP에서 1분에 ${DEMO_LIMITS.requestsPerMinute}번을 넘게 요청하면 429이다`, async () => {
    let last = 0;
    for (let i = 0; i < DEMO_LIMITS.requestsPerMinute + 1; i++) {
      last = (await api().get('/health')).status;
    }
    expect(last).toBe(429);
  });
});
