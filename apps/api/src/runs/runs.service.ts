import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { graphSchema, NODE_SPECS, validateGraph } from '@nodeloom/core';
import { QueueService } from '../executor/queue.js';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  // 저장된 그래프로 실행한다(M4 작은 결정 ⑦). 검사 오류가 있으면 422, 이미 실행 중이면 409(DECISIONS 7-5).
  async start(workflowId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) throw new NotFoundException('워크플로우를 찾을 수 없습니다');

    const graph = graphSchema.parse(workflow.graph);
    const issues = validateGraph(graph);
    if (issues.length > 0) {
      throw new UnprocessableEntityException({
        message: `검사 오류 ${issues.length}개가 있어 실행할 수 없습니다`,
        issues,
      });
    }
    // 검사를 통과했으면 Trigger는 정확히 하나다(DECISIONS A-4). 수동 실행의 입력은 테스트 입력(B-10).
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

  // 목록은 최근 50개(M5 작은 결정 ③). 30일 보존이라 페이지 넘김 없이 충분하다.
  async list(workflowId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    });
    if (!workflow) throw new NotFoundException('워크플로우를 찾을 수 없습니다');
    return this.prisma.run.findMany({
      where: { workflowId },
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

  // 상세 화면은 실행 당시 그래프(스냅샷)를 그린다(DECISIONS B-9). 입출력은 노드를 고를 때 따로 받는다(B-1).
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

  // 1초마다 조회하므로 상태와 시간만 돌려준다. 노드 입출력은 돌려주지 않는다(DECISIONS B-1).
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
          select: { nodeId: true, nodeKey: true, status: true, attempt: true },
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
