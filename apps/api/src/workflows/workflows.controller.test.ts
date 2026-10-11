import type { INestApplication } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION, type Graph } from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { startTestApp, TEST_PASSWORD } from '../test-app.test-util.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { QueueService } from '../executor/queue.js';

const node = (id: string, type: 'trigger' | 'transform', config = {}) => ({
  id,
  key: id,
  type,
  title: id,
  position: { x: 0, y: 0 },
  config,
});
const edge = (from: string, to: string) => ({
  id: `${from}->${to}`,
  from: { node: from, port: 'out' },
  to: { node: to, port: 'in' },
});
const graph = (nodes: Graph['nodes'], edges: Graph['edges'] = []): Graph => ({
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes,
  edges,
});

describe('/workflows', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  // 로그인 쿠키를 들고 다니는 요청 도구
  let agent: ReturnType<typeof request.agent>;
  let queue: QueueService;
  let SCHEDULE_QUEUE: string;
  const api = () => agent;
  // 만들고 새 id를 돌려준다.
  const create = async (name: string, g: Graph) =>
    (
      (await api().post('/workflows').send({ name, graph: g }).expect(201))
        .body as { id: string }
    ).id;
  const list = async () =>
    (await api().get('/workflows').expect(200)).body as {
      id: string;
      nodeCount: number;
    }[];

  beforeAll(async () => {
    ({ app, container } = await startTestApp());
    const mod = await import('../executor/queue.js');
    queue = app.get(mod.QueueService);
    SCHEDULE_QUEUE = mod.SCHEDULE_QUEUE;
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

  it('만들고 불러오면 같은 이름과 그래프가 돌아온다', async () => {
    const g = graph([node('trigger_1', 'trigger')]);
    const id = await create('아침 비 알림', g);
    const res = await api().get(`/workflows/${id}`).expect(200);
    expect(res.body).toMatchObject({ name: '아침 비 알림', graph: g });
  });

  it('덮어쓰기로 저장하면 바뀐 그래프가 돌아온다', async () => {
    const id = await create('a', graph([node('trigger_1', 'trigger')]));
    const next = graph(
      [
        node('trigger_1', 'trigger'),
        node('msg_1', 'transform', { expression: '1' }),
      ],
      [edge('trigger_1', 'msg_1')],
    );
    await api()
      .put(`/workflows/${id}`)
      .send({ name: 'b', graph: next })
      .expect(204);
    const res = await api().get(`/workflows/${id}`).expect(200);
    expect(res.body).toMatchObject({ name: 'b', graph: next });
  });

  it('순환이나 설정 오류가 있는 초안도 저장한다', async () => {
    const draft = graph(
      [node('a', 'transform'), node('b', 'transform')],
      [edge('a', 'b'), edge('b', 'a')],
    );
    await api()
      .post('/workflows')
      .send({ name: '초안', graph: draft })
      .expect(201);
  });

  it('그래프 모양이 깨졌거나 이름이 비어 있으면 400을 돌려준다', async () => {
    await api()
      .post('/workflows')
      .send({ name: 'x', graph: { nodes: 'not-array' } })
      .expect(400);
    await api()
      .post('/workflows')
      .send({ name: '  ', graph: graph([]) })
      .expect(400);
  });

  it('없는 워크플로우는 조회, 저장, 삭제 모두 404를 돌려준다', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    await api().get(`/workflows/${missing}`).expect(404);
    await api()
      .put(`/workflows/${missing}`)
      .send({ name: 'x', graph: graph([]) })
      .expect(404);
    await api().delete(`/workflows/${missing}`).expect(404);
    await api().get('/workflows/not-a-uuid').expect(404);
  });

  it('목록은 최근에 수정한 순서로 노드 수와 함께 돌려주고, 삭제하면 빠진다', async () => {
    const first = await create('먼저', graph([node('trigger_1', 'trigger')]));
    const second = await create('나중', graph([]));

    const before = await list();
    expect(before.findIndex((w) => w.id === second)).toBeLessThan(
      before.findIndex((w) => w.id === first),
    );
    expect(before.find((w) => w.id === first)?.nodeCount).toBe(1);

    await api().delete(`/workflows/${first}`).expect(204);
    expect((await list()).some((w) => w.id === first)).toBe(false);
  });
  describe('스케줄', () => {
    const withCron = (cron: string | null) =>
      graph([node('trigger_1', 'trigger', { cron })]);
    const schedules = (id: string) => queue.boss.getSchedules(SCHEDULE_QUEUE, id);
    const save = (id: string, g: Graph) =>
      api().put(`/workflows/${id}`).send({ name: 's', graph: g });

    it('저장한 cron대로 등록하고, cron을 지우거나 워크플로우를 지우면 해제한다', async () => {
      const id = await create('s', withCron('0 7 * * *'));
      expect(await schedules(id)).toMatchObject([
        { cron: '0 7 * * *', timezone: 'Asia/Seoul', data: { workflowId: id } },
      ]);

      await save(id, withCron('30 8 * * 1-5')).expect(204);
      expect(await schedules(id)).toMatchObject([{ cron: '30 8 * * 1-5' }]);

      await save(id, withCron(null)).expect(204);
      expect(await schedules(id)).toEqual([]);

      await save(id, withCron('0 7 * * *')).expect(204);
      await api().delete(`/workflows/${id}`).expect(204);
      expect(await schedules(id)).toEqual([]);
    });

    it('틀린 cron은 저장하되 스케줄은 해제한다', async () => {
      const id = await create('s', withCron('0 7 * * *'));
      await save(id, withCron('0 25 * * *')).expect(204);
      expect(await schedules(id)).toEqual([]);
      const res = await api().get(`/workflows/${id}`).expect(200);
      expect(res.body).toMatchObject({ graph: withCron('0 25 * * *') });
    });

    it('cron 말고 다른 검사 오류가 있어도 등록한다(실행할 때 FAILED로 남긴다)', async () => {
      const g = withCron('0 7 * * *');
      // Trigger에서 이어지지 않은 노드
      g.nodes.push(node('orphan_1', 'transform', { expression: '1' }));
      const id = await create('s', g);
      expect(await schedules(id)).toMatchObject([{ cron: '0 7 * * *' }]);
    });

    it('스케줄 등록이 실패하면 저장도 되돌아간다', async () => {
      const id = await create('s', withCron(null));
      const spy = vi
        .spyOn(queue.boss, 'schedule')
        .mockRejectedValueOnce(new Error('등록 실패'));
      await save(id, withCron('0 7 * * *')).expect(500);
      spy.mockRestore();
      const res = await api().get(`/workflows/${id}`).expect(200);
      expect(res.body).toMatchObject({ graph: withCron(null) });
    });
  });
});
