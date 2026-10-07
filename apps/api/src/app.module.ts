import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';

@Module({
  imports: [PrismaModule, WorkflowsModule],
  controllers: [HealthController],
})
export class AppModule {}
