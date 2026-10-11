import { Module } from '@nestjs/common';
import { ExecutorModule } from '../executor/executor.module.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  imports: [ExecutorModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
})
export class WorkflowsModule {}
