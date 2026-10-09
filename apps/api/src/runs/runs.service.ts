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
    if (!run) throw new NotFoundException('실행 기록을 찾을 수 없습니다');
    // 노드마다 마지막 시도만
    const { nodeRuns, ...rest } = run;
    const nodes = new Map(nodeRuns.map((r) => [r.nodeId, r]));
    return { ...rest, nodes: [...nodes.values()] };
  }
}
