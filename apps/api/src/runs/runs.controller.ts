import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
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

  @Get('runs/:id/status')
  status(@Param('id', id) runId: string) {
    return this.runs.status(runId);
  }
}
