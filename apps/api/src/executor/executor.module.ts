import { Module } from '@nestjs/common';
import { QueueService } from './queue.js';
import { RunExecutor } from './run-executor.js';

@Module({ providers: [QueueService, RunExecutor], exports: [QueueService] })
export class ExecutorModule {}
