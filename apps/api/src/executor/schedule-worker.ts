import {
  ConflictException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { checkGraph } from '@nodeloom/core';
import type { JobWithMetadata } from 'pg-boss';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma.service.js';
import { QueueService, SCHEDULE_QUEUE, type ScheduleJob } from './queue.js';
import { RunExecutor } from './run-executor.js';

// 이보다 오래된 회차는 실행하지 않는다. 워커가 없던 동안 쌓인 회차가 한꺼번에 돌지 않게 한다.
const STALE_MS = 2 * 60_000;

// pg-boss가 cron 시각마다 넣은 job을 받아 스케줄 실행을 만든다(DECISIONS 7-5, B-10).
@Injectable()
export class ScheduleWorker implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly executor: RunExecutor,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.boss.work(
      SCHEDULE_QUEUE,
      { includeMetadata: true },
      async (jobs: JobWithMetadata<ScheduleJob>[]) => {
        for (const job of jobs)
          await this.handle(job.data, job.createdOn, job.id);
      },
    );
  }

  async handle({ workflowId }: ScheduleJob, createdOn: Date, jobId: string) {
    // 시험용 시계로 돌릴 때도 같은 시각으로 비교하도록 pg-boss의 시계를 쓴다.
    if (this.queue.clock.now() - createdOn.getTime() > STALE_MS) {
      this.logger.warn(`skip stale schedule job workflowId=${workflowId}`);
      return;
    }
    // 삭제 직전에 큐에 들어간 회차는 워크플로우가 없다.
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });
    if (!workflow) return;

    const checked = checkGraph(workflow.graph);
    // 검사에 실패하면 실행하지 않고 FAILED로 남겨 실패 알림을 보낸다(DECISIONS 7-5).
    if (!checked.ok) {
      const { issues } = checked;
      const error = {
        code: 'INVALID_GRAPH',
        message: `검사 오류 ${issues.length}개가 있어 실행하지 않았습니다`,
      };
      // 실행 id를 job id로 정해, 알림을 만들다 오류가 나 같은 회차를 다시 받아도 기록이 하나만 남게 한다.
      const run = await this.prisma.run.upsert({
        where: { id: jobId },
        update: {},
        create: {
          id: jobId,
          workflowId,
          kind: 'SCHEDULE',
          status: 'FAILED',
          graph: workflow.graph as Prisma.InputJsonObject,
          triggerInput: {},
          error: { ...error, issues },
          finishedAt: new Date(),
        },
      });
      await this.executor.startFailureRun(run, error);
      return;
    }

    try {
      await this.queue.enqueueRun({
        workflowId,
        kind: 'SCHEDULE',
        graph: checked.graph,
        triggerInput: {},
      });
    } catch (e) {
      // 이미 실행 중이면 이번 회차는 건너뛴다(DECISIONS 7-5).
      if (e instanceof ConflictException) {
        this.logger.warn(
          `skip schedule, already running workflowId=${workflowId}`,
        );
        return;
      }
      throw e;
    }
  }
}
