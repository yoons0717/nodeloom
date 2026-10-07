import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Graph, graphSchema } from '@nodeloom/core';
import { DEMO_LIMITS } from '../demo-limits.js';
import { env } from '../env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import type { WorkflowBody } from './workflows.schemas.js';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      nodeCount: toGraph(w.graph).nodes.length,
      updatedAt: w.updatedAt,
    }));
  }

  async get(id: string) {
    const w = await this.prisma.workflow.findUnique({ where: { id } });
    if (!w) throw notFound();
    return {
      id: w.id,
      name: w.name,
      graph: toGraph(w.graph),
      updatedAt: w.updatedAt,
    };
  }

  async create(body: WorkflowBody) {
    if (env.DEMO_MODE) {
      const count = await this.prisma.workflow.count();
      if (count >= DEMO_LIMITS.workflows)
        throw new ForbiddenException(
          `데모에서는 워크플로우를 ${DEMO_LIMITS.workflows}개까지 만들 수 있습니다`,
        );
    }
    checkDemoGraph(body);
    const w = await this.prisma.workflow.create({ data: toRow(body) });
    return { id: w.id };
  }

  // 덮어쓰기 저장. 버전 비교(409)는 하지 않는다(DECISIONS 2-4).
  async update(id: string, body: WorkflowBody) {
    checkDemoGraph(body);
    const { count } = await this.prisma.workflow.updateMany({
      where: { id },
      data: toRow(body),
    });
    if (count === 0) throw notFound();
  }

  async remove(id: string) {
    const { count } = await this.prisma.workflow.deleteMany({ where: { id } });
    if (count === 0) throw notFound();
  }
}

function checkDemoGraph(body: WorkflowBody) {
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
