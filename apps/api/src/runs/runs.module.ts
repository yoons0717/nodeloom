import { Module } from '@nestjs/common';
import { ExecutorModule } from '../executor/executor.module.js';
import { RunsController } from './runs.controller.js';
import { RunsService } from './runs.service.js';

@Module({
  imports: [ExecutorModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
