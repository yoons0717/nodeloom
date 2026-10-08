import type { INestApplication } from '@nestjs/common';
import {
  GRAPH_SCHEMA_VERSION,
  type Graph,
  type GraphNode,
  type NodeType,
} from '@nodeloom/core';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { Prisma } from '../generated/prisma/client.js';
// env.ts를 읽는 모듈은 startTestApp이 환경 변수를 넣은 뒤에 import한다(값은 beforeAll에서).
import type { PrismaService } from '../prisma.service.js';
import { startTestApp } from '../test-app.test-util.js';
import type { RunExecutor } from './run-executor.js';

const n = (
  key: string,
  type: NodeType,
  config: Record<string, unknown> = {},
): GraphNode => ({
  id: key,
  key,
  type,
  title: key,
  position: { x: 0, y: 0 },
  config,
});
const e = (from: string, to: string, port = 'out') => ({
  id: `${from}:${port}->${to}`,
  from: { node: from, port },
  to: { node: to, port: 'in' },
});
const g = (nodes: GraphNode[], edges: Graph['edges']): Graph => ({
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes,
  edges,
});
const trigger = (testInput: unknown = {}) =>
  n('trigger', 'trigger', { testInput });

describe('실행 엔진', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;
  let executor: RunExecutor;
  let base: string;

  beforeAll(async () => {
    ({ app, container } = await startTestApp({
      RUN_TIMEOUT: '3',
      NODELOOM_SECRET_TOKEN: 'secret-token-1234',
    }));
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
    const { PrismaService } = await import('../prisma.service.js');
    const { RunExecutor } = await import('./run-executor.js');
    prisma = app.get(PrismaService);
    executor = app.get(RunExecutor);
    executor.retryBaseMs = 5;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const http = (key: string, url: string, extra = {}) =>
    n(key, 'http', { url: `${base}${url}`, ...extra });

  // 워크플로우와 PENDING 실행 기록을 만든다. job 없이 만들어 워커가 집어 가지 않는다.
  const createRun = async (
    graph: Graph,
    opts: { failureWorkflowId?: string; triggerInput?: unknown } = {},
  ) => {
    const wf = await prisma.workflow.create({
      data: {
        name: 'w',
        graph: graph as Prisma.InputJsonObject,
        failureWorkflowId: opts.failureWorkflowId,
      },
    });
    const run = await prisma.run.create({
      data: {
        workflowId: wf.id,
        kind: 'MANUAL',
        graph: graph as Prisma.InputJsonObject,
        triggerInput: opts.triggerInput ?? {},
      },
    });
    return { workflowId: wf.id, runId: run.id };
  };
  const execute = async (graph: Graph, opts = {}) => {
    const ids = await createRun(graph, opts);
    await executor.execute(ids.runId);
    return { ...ids, ...(await result(ids.runId)) };
  };
  const result = async (runId: string) => {
    const run = await prisma.run.findUniqueOrThrow({
      where: { id: runId },
      include: {
        nodeRuns: { orderBy: [{ nodeKey: 'asc' }, { attempt: 'asc' }] },
      },
    });
    // 노드별 마지막 시도의 상태
    const status = Object.fromEntries(
      run.nodeRuns.map((r) => [r.nodeKey, r.status]),
    );
    return { run, status };
  };

  it('순서대로 실행하고 $nodes, $run, $secrets를 식에서 쓴다', async () => {
    const { run, status } = await execute(
      g(
        [
          trigger(),
          n('pick', 'transform', { expression: '{ "city": city }' }),
          http('send', '/mock/echo', {
            method: 'POST',
            headers: { authorization: '{{ $secrets.TOKEN }}' },
            body: '{ "city": $nodes.pick.city, "run": $run.id }',
          }),
        ],
        [e('trigger', 'pick'), e('pick', 'send')],
      ),
      { triggerInput: { city: 'Busan' } },
    );
    expect(run.status).toBe('SUCCESS');
    expect(status).toEqual({
      trigger: 'SUCCESS',
      pick: 'SUCCESS',
      send: 'SUCCESS',
    });
    const send = run.nodeRuns.find((r) => r.nodeKey === 'send');
    expect(send?.output).toMatchObject({
      headers: { authorization: 'secret-token-1234' },
      body: { city: 'Busan', run: run.id },
    });
  });

  it('Condition이 고르지 않은 갈래는 건너뛰고, 합류 노드는 성공한 부모만 받는다', async () => {
    const { run, status } = await execute(
      g(
        [
          trigger(),
          n('check', 'condition', { expression: 'true' }),
          n('yes', 'transform', { expression: '"Y"' }),
          n('no', 'transform', { expression: '"N"' }),
          n('join', 'transform', { expression: '$' }),
        ],
        [
          e('trigger', 'check'),
          e('check', 'yes', 'true'),
          e('check', 'no', 'false'),
          e('yes', 'join'),
          e('no', 'join'),
        ],
      ),
    );
    expect(run.status).toBe('SUCCESS');
    expect(status).toMatchObject({
      yes: 'SUCCESS',
      no: 'SKIPPED',
      join: 'SUCCESS',
    });
    expect(run.nodeRuns.find((r) => r.nodeKey === 'join')?.output).toEqual({
      yes: 'Y',
    });
  });

  it('실패한 노드의 하위는 건너뛰고 실행은 FAILED. 다른 갈래는 계속 실행', async () => {
    const { run, status } = await execute(
      g(
        [
          trigger(),
          http('bad', '/mock/status/404'),
          n('ok', 'transform', { expression: '1' }),
          n('join', 'transform', { expression: '$' }),
        ],
        [
          e('trigger', 'bad'),
          e('trigger', 'ok'),
          e('bad', 'join'),
          e('ok', 'join'),
        ],
      ),
    );
    expect(status).toEqual({
      trigger: 'SUCCESS',
      bad: 'FAILED',
      ok: 'SUCCESS',
      join: 'SKIPPED',
    });
    expect(run).toMatchObject({
      status: 'FAILED',
      error: { code: 'NODE_FAILED', nodeKey: 'bad', message: '응답 코드 404' },
    });
  });

  it('재시도 대상 실패만 설정한 횟수만큼 다시 시도하고 시도마다 기록한다', async () => {
    const attempts = async (url: string) => {
      const { run } = await execute(
        g([trigger(), http('h', url, { retry: 2 })], [e('trigger', 'h')]),
      );
      return run.nodeRuns
        .filter((r) => r.nodeKey === 'h')
        .map((r) => r.attempt);
    };
    expect(await attempts('/mock/status/503')).toEqual([1, 2, 3]);
    expect(await attempts('/mock/status/400')).toEqual([1]);
  });

  it('실행 전체 시간 제한을 넘으면 진행 중인 요청을 끊고 FAILED', async () => {
    const started = Date.now();
    const { run, status } = await execute(
      g(
        [trigger(), http('slow', '/mock/slow?ms=10000')],
        [e('trigger', 'slow')],
      ),
    );
    expect(Date.now() - started).toBeLessThan(6000);
    expect(run.error).toMatchObject({ code: 'RUN_TIMEOUT' });
    expect(status.slow).toBe('FAILED');
  });

  it('재개: 이미 성공한 노드는 다시 실행하지 않고, 끝나지 않은 노드는 다음 시도 번호로 실행', async () => {
    const graph = g(
      [
        trigger(),
        n('a', 'transform', { expression: '$.v' }),
        n('b', 'transform', { expression: '$ + 1' }),
      ],
      [e('trigger', 'a'), e('a', 'b')],
    );
    const { runId } = await createRun(graph);
    // 서버가 b를 실행하다 죽은 상태
    await prisma.run.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    await prisma.nodeRun.createMany({
      data: [
        {
          runId,
          nodeId: 'trigger',
          nodeKey: 'trigger',
          attempt: 1,
          status: 'SUCCESS',
          output: { v: 1 },
        },
        // 저장된 결과를 다시 쓰는지 보려고 실제로는 나올 수 없는 값을 넣어 둔다.
        {
          runId,
          nodeId: 'a',
          nodeKey: 'a',
          attempt: 1,
          status: 'SUCCESS',
          output: 41,
        },
        { runId, nodeId: 'b', nodeKey: 'b', attempt: 1, status: 'RUNNING' },
      ],
    });

    await executor.execute(runId);

    const { run } = await result(runId);
    expect(run.status).toBe('SUCCESS');
    expect(
      run.nodeRuns.map((r) => [r.nodeKey, r.attempt, r.status, r.output]),
    ).toEqual([
      ['a', 1, 'SUCCESS', 41],
      ['b', 1, 'RUNNING', null],
      ['b', 2, 'SUCCESS', 42],
      ['trigger', 1, 'SUCCESS', { v: 1 }],
    ]);
  });

  describe('실패 알림', () => {
    const failing = () =>
      g([trigger(), http('bad', '/mock/status/500')], [e('trigger', 'bad')]);
    const createWorkflow = async (graph: Graph) =>
      (
        await prisma.workflow.create({
          data: { name: '알림', graph: graph as Prisma.InputJsonObject },
        })
      ).id;
    const failureRuns = (workflowId: string) =>
      prisma.run.findMany({
        where: { workflowId, kind: 'FAILURE' },
        include: { nodeRuns: true },
      });

    it('실패하면 지정한 워크플로우를 실패 정보와 함께 실행한다', async () => {
      const alertId = await createWorkflow(
        g(
          [trigger(), n('msg', 'transform', { expression: '$' })],
          [e('trigger', 'msg')],
        ),
      );
      const { runId, workflowId } = await execute(failing(), {
        failureWorkflowId: alertId,
      });

      // 실패 알림은 대기열을 거쳐 워커가 실행한다.
      await vi.waitFor(
        async () =>
          expect((await failureRuns(alertId))[0]?.status).toBe('SUCCESS'),
        { timeout: 10_000, interval: 200 },
      );
      const [alert] = await failureRuns(alertId);
      expect(alert?.nodeRuns.find((r) => r.nodeKey === 'msg')?.output).toEqual({
        workflow: { id: workflowId, name: 'w' },
        runId,
        failedNode: 'bad',
        error: '응답 코드 500',
      });
    });

    it('실패 알림 실행이 실패해도 다시 알리지 않는다', async () => {
      // 자기 자신을 실패 알림으로 지정해도 연쇄되지 않는다.
      const alertId = await createWorkflow(failing());
      await prisma.workflow.update({
        where: { id: alertId },
        data: { failureWorkflowId: alertId },
      });
      const run = await prisma.run.create({
        data: {
          workflowId: alertId,
          kind: 'FAILURE',
          graph: failing() as Prisma.InputJsonObject,
          triggerInput: {},
        },
      });
      await executor.execute(run.id);
      expect((await failureRuns(alertId)).map((r) => r.status)).toEqual([
        'FAILED',
      ]);
    });

    it('실패 알림 워크플로우에 검사 오류가 있으면 실행하지 않고 FAILED로 기록만 한다', async () => {
      const alertId = await createWorkflow(g([], []));
      await execute(failing(), { failureWorkflowId: alertId });
      const runs = await failureRuns(alertId);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({
        status: 'FAILED',
        error: { code: 'INVALID_GRAPH' },
        nodeRuns: [],
      });
    });
  });
});
