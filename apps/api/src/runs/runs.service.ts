import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { checkGraph, graphSchema, NODE_SPECS } from '@nodeloom/core';
import { QueueService } from '../executor/queue.js';
import { PrismaService } from '../prisma.service.js';

// 실행 기록 화면의 상태 거르기(?status=). 대기 중도 "실행 중"으로 친다.
function statusFilter(filter: string | undefined) {
  switch (filter) {
    case 'failed':
      return { equals: 'FAILED' as const };
    case 'success':
      return { equals: 'SUCCESS' as const };
    case 'running':
      return { in: ['PENDING' as const, 'RUNNING' as const] };
  }
}

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  // 저장된 그래프로 실행한다. 검사 오류가 있으면 422, 이미 실행 중이면 409.
  async start(workflowId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) throw new NotFoundException('워크플로우를 찾을 수 없습니다');

    const checked = checkGraph(workflow.graph);
    if (!checked.ok) {
      throw new UnprocessableEntityException({
        message: `검사 오류 ${checked.issues.length}개가 있어 실행할 수 없습니다`,
        issues: checked.issues,
      });
    }
    const { graph } = checked;
    // 검사를 통과했으면 Trigger는 정확히 하나다. 수동 실행의 입력은 테스트 입력.
    const trigger = graph.nodes.find((n) => n.type === 'trigger')!;
    const { testInput } = NODE_SPECS.trigger.config.parse(trigger.config);
    const runId = await this.queue.enqueueRun({
      workflowId,
      kind: 'MANUAL',
      graph,
      triggerInput: testInput ?? {},
    });
    return { runId };
  }

  // 목록은 최근 50개. 상태로 거르면 그 상태의 최근 50개.
  async list(workflowId: string, filter?: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    });
    if (!workflow) throw new NotFoundException('워크플로우를 찾을 수 없습니다');
    return this.prisma.run.findMany({
      where: { workflowId, status: statusFilter(filter) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        kind: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  }

  // 모든 워크플로우의 최근 50건(M6 6-g "모든 실행"). 상태로 거른다. 입출력·그래프는 넣지 않는다.
  allRuns(filter: string | undefined) {
    return this.prisma.run.findMany({
      where: { status: statusFilter(filter) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        kind: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        workflow: { select: { id: true, name: true } },
      },
    });
  }

  // 사이드바의 실패 배지와 다시 불러올지 판단에 쓰는 요약(M6 6-g).
  async summary() {
    const [failedLast24h, running] = await Promise.all([
      this.prisma.run.count({
        where: {
          status: 'FAILED',
          finishedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
        },
      }),
      this.prisma.run.count({
        where: { status: { in: ['PENDING', 'RUNNING'] } },
      }),
    ]);
    return { failedLast24h, running };
  }

  // 상세 화면은 실행 당시 그래프(스냅샷)를 그린다. 입출력은 노드를 고를 때 따로 받는다.
  async detail(runId: string) {
    const [run, status] = await Promise.all([
      this.prisma.run.findUnique({
        where: { id: runId },
        select: { workflowId: true, kind: true, graph: true },
      }),
      this.status(runId),
    ]);
    if (!run) throw notFound();
    return { ...status, ...run, graph: graphSchema.parse(run.graph) };
  }

  async nodeAttempts(runId: string, nodeId: string) {
    const attempts = await this.prisma.nodeRun.findMany({
      where: { runId, nodeId },
      orderBy: { attempt: 'asc' },
      select: {
        attempt: true,
        status: true,
        port: true,
        input: true,
        output: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (attempts.length === 0)
      throw new NotFoundException('이 노드의 실행 기록이 없습니다');
    return attempts;
  }

  // 1초마다 조회하므로 상태와 시간만 돌려준다. 노드 입출력은 돌려주지 않는다.
  async status(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        error: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        nodeRuns: {
          // 노드 카드에 걸린 시간을 보여 주려고 시작·끝 시각도 함께.
          select: {
            nodeId: true,
            nodeKey: true,
            status: true,
            attempt: true,
            // Condition이 고른 포트. 실행 상세에서 지나간 연결선을 칠한다.
            port: true,
            startedAt: true,
            finishedAt: true,
          },
          orderBy: { attempt: 'asc' },
        },
      },
    });
    if (!run) throw notFound();
    // 노드마다 마지막 시도만
    const { nodeRuns, ...rest } = run;
    const nodes = new Map(nodeRuns.map((r) => [r.nodeId, r]));
    return { ...rest, nodes: [...nodes.values()] };
  }
}

function notFound() {
  return new NotFoundException('실행 기록을 찾을 수 없습니다');
}
