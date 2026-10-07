import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { GRAPH_SCHEMA_VERSION } from '@nodeloom/core';
import { Public } from './auth/public.decorator.js';
import { PrismaService } from './prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'ok', graphSchemaVersion: GRAPH_SCHEMA_VERSION };
  }
}
