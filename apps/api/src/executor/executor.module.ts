import { Module } from '@nestjs/common';
import { systemClock } from 'pg-boss';
import { PG_BOSS_CLOCK } from './pg-boss-clock.js';
import { QueueService } from './queue.js';
import { RunCleanup } from './run-cleanup.js';
import { RunExecutor } from './run-executor.js';
import { ScheduleWorker } from './schedule-worker.js';

@Module({
  providers: [
    { provide: PG_BOSS_CLOCK, useValue: systemClock },
    QueueService,
    RunExecutor,
    ScheduleWorker,
    RunCleanup,
  ],
  exports: [QueueService],
})
export class ExecutorModule {}
