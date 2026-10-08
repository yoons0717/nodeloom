import { Module } from '@nestjs/common';
import { QueueService } from './queue.js';

@Module({ providers: [QueueService], exports: [QueueService] })
export class ExecutorModule {}
