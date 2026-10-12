import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { RunsService } from './runs.service.js';

const id = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  // 실행은 대기열에 넣고 바로 돌려준다. 화면은 상태를 따로 조회한다.
  @Post('workflows/:id/runs')
  @HttpCode(202)
  start(@Param('id', id) workflowId: string) {
    return this.runs.start(workflowId);
  }

  @Get('workflows/:id/runs')
  list(@Param('id', id) workflowId: string) {
    return this.runs.list(workflowId);
  }

  // runs/:id보다 먼저 둔다. 뒤에 두면 summary가 실행 id로 읽힌다.
  @Get('runs/summary')
  summary() {
    return this.runs.summary();
  }

  @Get('runs')
  allRuns(@Query('status') status?: string) {
    return this.runs.allRuns(status);
  }

  @Get('runs/:id')
  detail(@Param('id', id) runId: string) {
    return this.runs.detail(runId);
  }

  @Get('runs/:id/nodes/:nodeId')
  nodeAttempts(
    @Param('id', id) runId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.runs.nodeAttempts(runId, nodeId);
  }

  @Get('runs/:id/status')
  status(@Param('id', id) runId: string) {
    return this.runs.status(runId);
  }
}
