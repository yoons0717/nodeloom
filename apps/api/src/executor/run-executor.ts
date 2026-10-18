import { setTimeout as sleep } from 'node:timers/promises';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  buildInput,
  checkGraph,
  decideNode,
  type GraphNode,
  graphSchema,
  NODE_SPECS,
  type NodeRunState,
} from '@nodeloom/core';
import { env, secrets } from '../env.js';
import { Prisma, type Run } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { createMasker } from './mask.js';
import { NodeError } from './nodes/node-error.js';
import { runNode } from './nodes/run-node.js';
import { createHttpGuard } from './nodes/ssrf.js';
import {
  QueueService,
  RUN_DEAD_QUEUE,
  RUN_QUEUE,
  type RunJob,
} from './queue.js';

// 동시에 실행하는 흐름 수. 같은 흐름은 인덱스가 하나로 막는다(DECISIONS 7-5).
const CONCURRENT_RUNS = 5;

export type RunError = { code: string; message: string; nodeKey?: string };

const ABORTED: RunError = {
  code: 'RUN_ABORTED',
  message: '실행 엔진이 반복해서 멈춰 실행을 중단했습니다',
};

// 엔진이 멈춰 끝나지 않은 노드 시도에 남기는 오류
const STALE_ATTEMPT = {
  message: '실행 엔진이 멈춰 이 시도가 끝나지 않았습니다',
};

@Injectable()
export class RunExecutor implements OnApplicationBootstrap {
  private readonly logger = new Logger(RunExecutor.name);
  // 재시도 대기의 첫 간격(1·2·4초…, DECISIONS 7-3). 테스트에서 줄인다.
  retryBaseMs = 1000;
  // HTTP 노드가 보낼 수 있는 곳(DECISIONS 8-1). 테스트에서 연습용 응답 주소를 바꾼다.
  httpGuard = createHttpGuard({
    mockBase: env.MOCK_BASE_URL,
    demo: env.DEMO_MODE,
    allowPrivate: env.HTTP_ALLOW_PRIVATE,
  });
  private readonly masker = createMasker(Object.values(secrets));

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.boss.work<RunJob>(
      RUN_QUEUE,
      { localConcurrency: CONCURRENT_RUNS },
      async (jobs) => {
        for (const job of jobs) await this.execute(job.data.runId);
      },
    );
    await this.queue.boss.work<RunJob>(RUN_DEAD_QUEUE, async (jobs) => {
      for (const job of jobs) await this.abort(job.data.runId);
    });
  }

  // 실행 엔진이 시도 횟수를 다 쓰도록 죽었다(DB 오류 등). 끝나지 않은 실행을 FAILED로 끝내야
  // 동시 실행 제한이 풀려 다음 실행과 스케줄이 막히지 않는다(M5 작은 결정 ⑤).
  async abort(runId: string) {
    const { count } = await this.prisma.run.updateMany({
      where: { id: runId, status: { in: ['PENDING', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        error: ABORTED,
        finishedAt: new Date(),
      },
    });
    if (count > 0)
      this.logger.error(`run aborted after retries runId=${runId}`);
    await this.closeStaleAttempts(runId);
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    // 지난번에 알림을 만들다 실패했으면 이번에 만든다.
    if (run) await this.alertIfFailed(run);
  }

  // 실행 하나를 끝까지 돌린다. 서버가 죽었다 다시 불려도 이어서 실행한다(DECISIONS 7-1).
  // 여기서 던지는 오류(DB 끊김 등)는 pg-boss가 job을 다시 시도하게 한다.
  async execute(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { nodeRuns: { orderBy: { attempt: 'asc' } } },
    });
    if (!run || run.status === 'SUCCESS') return;
    // 이미 끝났는데 job을 다시 받았다 = 끝낸 뒤 실패 알림을 만들다 오류가 났을 수 있다.
    if (run.status === 'FAILED') return this.alertIfFailed(run);

    // 멈춘 엔진이 실행 중으로 남긴 시도를 닫는다. 그 노드는 아래에서 다음 시도 번호로 다시 실행한다.
    await this.closeStaleAttempts(runId);
    const startedAt = run.startedAt ?? new Date();
    await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt },
    });

    // 실행과 재개는 저장된 워크플로우가 아니라 스냅샷만 읽는다(DECISIONS B-9).
    const graph = graphSchema.parse(run.graph);
    const states: Record<string, NodeRunState> = {};
    const outputs: Record<string, unknown> = {};
    const nextAttempt: Record<string, number> = {};
    // 재개: 이미 성공·건너뜀으로 끝난 노드는 다시 실행하지 않고 저장된 결과를 쓴다.
    // 끝나지 않은 노드는 다음 시도 번호로 처음부터 다시 실행한다("최소 한 번 실행", DECISIONS B-2).
    for (const r of run.nodeRuns) {
      nextAttempt[r.nodeId] = r.attempt + 1;
      if (r.status === 'SUCCESS') {
        states[r.nodeId] = { status: 'success', port: r.port ?? undefined };
        outputs[r.nodeId] = r.output;
      } else if (r.status === 'SKIPPED') {
        states[r.nodeId] = { status: 'skipped' };
      }
    }
    const takeAttempt = (nodeId: string) => {
      const a = nextAttempt[nodeId] ?? 1;
      nextAttempt[nodeId] = a + 1;
      return a;
    };

    // 실행 기록에는 비밀값을 가려서 저장한다(DECISIONS 8-2).
    const store = (value: unknown) => toJson(this.masker.value(value));
    const runInfo = {
      id: run.id,
      workflowId: run.workflowId,
      kind: run.kind,
      startedAt: startedAt.toISOString(),
    };
    const nodesByKey = () =>
      Object.fromEntries(
        graph.nodes
          .filter((n) => states[n.id]?.status === 'success')
          .map((n) => [n.key, outputs[n.id]]),
      );

    // 실행 전체 시간 제한(DECISIONS 7-3). 재개해도 처음 시작한 시각부터 잰다.
    const deadline = new AbortController();
    const remaining = startedAt.getTime() + env.RUN_TIMEOUT * 1000 - Date.now();
    if (remaining <= 0) deadline.abort();
    const timer = setTimeout(() => deadline.abort(), Math.max(remaining, 0));
    const timedOut = new Promise<void>((resolve) =>
      deadline.signal.addEventListener('abort', () => resolve(), {
        once: true,
      }),
    );

    let failure: RunError | undefined;

    const runOne = async (node: GraphNode) => {
      const input =
        node.type === 'trigger'
          ? run.triggerInput
          : buildInput(node.id, graph, states, outputs);
      const maxTries =
        node.type === 'http'
          ? NODE_SPECS.http.config.parse(node.config).retry + 1
          : 1;

      for (let tries = 1; ; tries++) {
        const row = await this.prisma.nodeRun.create({
          data: {
            runId,
            nodeId: node.id,
            nodeKey: node.key,
            attempt: takeAttempt(node.id),
            status: 'RUNNING',
            input: store(input),
          },
        });
        try {
          const result = await runNode(
            node,
            { input, nodes: nodesByKey(), run: runInfo, secrets },
            { signal: deadline.signal, guard: this.httpGuard },
          );
          await this.prisma.nodeRun.update({
            where: { id: row.id },
            data: {
              status: 'SUCCESS',
              output: store(result.output),
              port: result.port,
              finishedAt: new Date(),
            },
          });
          outputs[node.id] = result.output;
          states[node.id] = { status: 'success', port: result.port };
          return;
        } catch (e) {
          const err =
            e instanceof NodeError
              ? e
              : new NodeError(e instanceof Error ? e.message : String(e));
          await this.prisma.nodeRun.update({
            where: { id: row.id },
            data: {
              status: 'FAILED',
              error: store({ message: err.message, details: err.details }),
              finishedAt: new Date(),
            },
          });
          if (err.retryable && tries < maxTries && !deadline.signal.aborted) {
            await sleep(this.backoffMs(tries), undefined, {
              signal: deadline.signal,
            }).catch(() => {});
            if (!deadline.signal.aborted) continue;
          }
          states[node.id] = { status: 'failed' };
          failure ??= {
            code: 'NODE_FAILED',
            nodeKey: node.key,
            message: this.masker.text(err.message),
          };
          return;
        }
      }
    };

    // 판정(실행 / 건너뜀 / 기다림)을 반복한다. 실행할 수 있는 노드는 바로 시작해 병렬 갈래가 서로 기다리지 않는다.
    const running = new Map<string, Promise<void>>();
    try {
      while (!deadline.signal.aborted) {
        for (let changed = true; changed;) {
          changed = false;
          for (const node of graph.nodes) {
            if (states[node.id]) continue;
            const decision = decideNode(node.id, graph, states);
            if (decision === 'skip') {
              states[node.id] = { status: 'skipped' };
              await this.prisma.nodeRun.create({
                data: {
                  runId,
                  nodeId: node.id,
                  nodeKey: node.key,
                  attempt: takeAttempt(node.id),
                  status: 'SKIPPED',
                  finishedAt: new Date(),
                },
              });
              changed = true;
            } else if (decision === 'run') {
              states[node.id] = { status: 'running' };
              running.set(
                node.id,
                runOne(node).finally(() => running.delete(node.id)),
              );
            }
          }
        }
        if (running.size === 0) break;
        await Promise.race([...running.values(), timedOut]);
      }
    } finally {
      // 시간 제한에 걸렸으면 진행 중인 노드는 signal로 끊긴다. 오류로 빠져나올 때도 남은 노드가 끝나기를 기다린다.
      await Promise.allSettled(running.values());
      clearTimeout(timer);
    }

    const error: RunError | undefined = deadline.signal.aborted
      ? {
          code: 'RUN_TIMEOUT',
          message: `실행 전체 시간 제한(${env.RUN_TIMEOUT}초)을 넘었습니다`,
        }
      : failure;
    await this.prisma.run.update({
      where: { id: runId },
      data: {
        status: error ? 'FAILED' : 'SUCCESS',
        error: error ? store(error) : Prisma.DbNull,
        finishedAt: new Date(),
      },
    });
    this.logger.log(`실행 ${runId}: ${error ? `실패(${error.code})` : '성공'}`);

    // 실패 알림 실행이 실패하면 다시 알리지 않는다(DECISIONS 7-4).
    if (error && run.kind !== 'FAILURE') await this.startFailureRun(run, error);
  }

  private closeStaleAttempts(runId: string) {
    return this.prisma.nodeRun.updateMany({
      where: { runId, status: 'RUNNING' },
      data: { status: 'FAILED', error: STALE_ATTEMPT, finishedAt: new Date() },
    });
  }

  // 실패한 실행의 실패 알림을 만든다. 실패 알림 실행이 실패하면 다시 알리지 않는다(DECISIONS 7-4).
  private async alertIfFailed(run: Run) {
    if (run.status === 'FAILED' && run.kind !== 'FAILURE' && run.error)
      await this.startFailureRun(run, run.error as RunError);
  }

  // 1·2·4초…(최대 30초) + 흔들림(DECISIONS 7-3)
  private backoffMs(tries: number) {
    const base = Math.min(this.retryBaseMs * 2 ** (tries - 1), 30_000);
    return base * (0.75 + Math.random() * 0.5);
  }

  // 워크플로우에 지정된 실패 알림 워크플로우를 실행한다(DECISIONS 7-4, B-10).
  // 그 워크플로우가 검사에 걸리면 실행하지 않고 FAILED 기록만 남긴다(DECISIONS 7-5).
  async startFailureRun(run: Run, error: RunError) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: run.workflowId },
      include: { failureWorkflow: true },
    });
    const target = workflow?.failureWorkflow;
    if (!workflow || !target) return;
    // job을 다시 받아도 한 번만 알린다. 알림 실행의 Trigger 입력에 원래 실행 id가 들어 있다.
    const sent = await this.prisma.run.findFirst({
      where: {
        workflowId: target.id,
        kind: 'FAILURE',
        triggerInput: { path: ['runId'], equals: run.id },
      },
      select: { id: true },
    });
    if (sent) return;

    const triggerInput = {
      workflow: { id: workflow.id, name: workflow.name },
      runId: run.id,
      failedNode: error.nodeKey ?? null,
      // 알림에는 키(fx)보다 화면에 보이는 제목(환율)이 알아보기 쉽다.
      failedNodeTitle:
        graphSchema
          .safeParse(run.graph)
          .data?.nodes.find((n) => n.key === error.nodeKey)?.title ?? null,
      error: error.message,
    };
    const checked = checkGraph(target.graph);
    if (!checked.ok) {
      await this.prisma.run.create({
        data: {
          workflowId: target.id,
          kind: 'FAILURE',
          status: 'FAILED',
          graph: toJson(target.graph),
          triggerInput,
          error: toJson({
            code: 'INVALID_GRAPH',
            message:
              '실패 알림 워크플로우에 검사 오류가 있어 실행하지 않았습니다',
            issues: checked.issues,
          }),
          finishedAt: new Date(),
        },
      });
      return;
    }
    await this.queue.enqueueRun({
      workflowId: target.id,
      kind: 'FAILURE',
      graph: checked.graph,
      triggerInput,
    });
  }
}

// DB의 JSON 칸에 넣을 수 있는 값으로 바꾼다. 식 결과에 undefined나 함수가 섞여 있어도 저장되게 JSON을 한 번 거친다.
function toJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  const json = JSON.stringify(value);
  return json === undefined
    ? Prisma.JsonNull
    : (JSON.parse(json) as Prisma.InputJsonValue);
}
