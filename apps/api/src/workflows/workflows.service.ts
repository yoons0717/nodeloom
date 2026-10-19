import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Graph, graphSchema } from '@nodeloom/core';
import { DEMO_LIMITS } from '../demo-limits.js';
import { env } from '../env.js';
import { QueueService } from '../executor/queue.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import type {
  CreateWorkflowBody,
  FailureWorkflowBody,
  WorkflowBody,
} from './workflows.schemas.js';

const NEW_NAME = '새 워크플로우';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async list() {
    // 사이드바의 상태 표시를 위해 마지막 실행과 24시간 안의 실패 수를 함께(M6 6-g).
    const rows = await this.prisma.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, finishedAt: true },
        },
        _count: {
          select: {
            runs: {
              where: {
                status: 'FAILED',
                finishedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
              },
            },
          },
        },
      },
    });
    return rows.map((w) => {
      const graph = toGraph(w.graph);
      const cron = graph.nodes.find((n) => n.type === 'trigger')?.config.cron;
      return {
        id: w.id,
        name: w.name,
        nodeCount: graph.nodes.length,
        // 목록에 스케줄을 보여 준다. 틀린 cron도 그대로 내보내 화면이 오류로 표시한다.
        cron: typeof cron === 'string' ? cron : null,
        lastRun: w.runs[0] ?? null,
        failedLast24h: w._count.runs,
        updatedAt: w.updatedAt,
      };
    });
  }

  async get(id: string) {
    const w = await this.prisma.workflow.findUnique({ where: { id } });
    if (!w) throw notFound();
    return {
      id: w.id,
      name: w.name,
      graph: toGraph(w.graph),
      failureWorkflowId: w.failureWorkflowId,
      updatedAt: w.updatedAt,
    };
  }

  async create(input: CreateWorkflowBody) {
    if (env.DEMO_MODE) {
      const count = await this.prisma.workflow.count();
      if (count >= DEMO_LIMITS.workflows)
        throw new ForbiddenException(
          `데모에서는 워크플로우를 ${DEMO_LIMITS.workflows}개까지 만들 수 있습니다`,
        );
    }
    checkDemoGraph(input);
    const w = await this.prisma
      .$transaction(async (tx) => {
        const body = { ...input, name: input.name ?? (await newName(tx)) };
        const w = await tx.workflow.create({ data: toRow(body) });
        await this.queue.syncSchedule(tx, w.id, body.graph);
        return w;
      })
      .catch(rethrowNameTaken);
    return { id: w.id };
  }

  // 덮어쓰기 저장. 버전 비교는 하지 않는다(DECISIONS 2-4). 409는 이름이 겹칠 때만 나온다.
  async update(id: string, body: WorkflowBody) {
    checkDemoGraph(body);
    await this.prisma
      .$transaction(async (tx) => {
        const { count } = await tx.workflow.updateMany({
          where: { id },
          data: toRow(body),
        });
        if (count === 0) throw notFound();
        await this.queue.syncSchedule(tx, id, body.graph);
      })
      .catch(rethrowNameTaken);
  }

  async setFailureWorkflow(id: string, body: FailureWorkflowBody) {
    try {
      const { count } = await this.prisma.workflow.updateMany({
        where: { id },
        data: { failureWorkflowId: body.failureWorkflowId },
      });
      if (count === 0) throw notFound();
    } catch (e) {
      // 지정한 워크플로우가 없음(외래 키 위반)
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new UnprocessableEntityException(
          '실패 알림으로 지정할 워크플로우를 찾을 수 없습니다',
        );
      }
      throw e;
    }
  }

  // 실행 중이면 지우지 않는다. 지우면 스케줄은 해제되고 실행 기록도 함께 지워지고, 이 워크플로우를 실패 알림으로 지정한 설정은 비워진다(DECISIONS B-4, 외래 키 규칙).
  // ponytail: 확인과 삭제 사이에 실행이 시작될 수 있다. 그 실행은 기록이 지워져 실행기가 오류로 멈추고, 다시 시도할 때 기록이 없어 끝난다.
  async remove(id: string) {
    const running = await this.prisma.run.count({
      where: { workflowId: id, status: { in: ['PENDING', 'RUNNING'] } },
    });
    if (running > 0)
      throw new ConflictException('실행 중인 워크플로우는 삭제할 수 없습니다');
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.workflow.deleteMany({ where: { id } });
      if (count === 0) throw notFound();
      await this.queue.syncSchedule(tx, id, null);
    });
  }
}

// "새 워크플로우", "새 워크플로우 2"… 중 비어 있는 첫 이름
// ponytail: 이름 없이 만들기가 거의 동시에 둘 오면 같은 번호를 골라 늦은 쪽이 409를 받는다. 1인용이고 버튼이 요청 중에 막혀 있어 두었다. 생기면 P2002에서 한 번 다시 시도한다
async function newName(tx: Prisma.TransactionClient) {
  const taken = new Set(
    (
      await tx.workflow.findMany({
        where: { name: { startsWith: NEW_NAME } },
        select: { name: true },
      })
    ).map((w) => w.name),
  );
  if (!taken.has(NEW_NAME)) return NEW_NAME;
  let n = 2;
  while (taken.has(`${NEW_NAME} ${n}`)) n++;
  return `${NEW_NAME} ${n}`;
}

// 이름 유니크 제약 위반(P2002)을 409로 바꾼다.
function rethrowNameTaken(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
    throw new ConflictException('같은 이름의 워크플로우가 있습니다');
  throw e;
}

function checkDemoGraph(body: Pick<WorkflowBody, 'graph'>) {
  if (env.DEMO_MODE && body.graph.nodes.length > DEMO_LIMITS.nodesPerGraph)
    throw new ForbiddenException(
      `데모에서는 노드를 ${DEMO_LIMITS.nodesPerGraph}개까지 놓을 수 있습니다`,
    );
}

// 그래프는 JSON 요청 본문을 zod로 검사한 값이라 JSON으로 저장할 수 있다. config가 unknown이라 Prisma 타입과만 맞춰 준다.
function toRow(body: WorkflowBody) {
  return { name: body.name, graph: body.graph as Prisma.InputJsonObject };
}

// DB의 JSON 컬럼도 밖에서 들어온 값으로 보고 읽을 때 검사한다(CONVENTIONS 3).
function toGraph(value: unknown): Graph {
  return graphSchema.parse(value);
}

function notFound() {
  return new NotFoundException('워크플로우를 찾을 수 없습니다');
}
