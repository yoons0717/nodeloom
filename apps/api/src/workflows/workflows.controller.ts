import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type CreateWorkflowBody,
  createWorkflowBodySchema,
  type FailureWorkflowBody,
  failureWorkflowBodySchema,
  type WorkflowBody,
  workflowBodySchema,
} from './workflows.schemas.js';
import { WorkflowsService } from './workflows.service.js';

const body = new ZodValidationPipe(workflowBodySchema);
// 형식이 uuid가 아닌 id는 DB에 묻지 않고 404로 돌려준다. 있을 수 없는 id이기 때문이다.
const id = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list() {
    return this.workflows.list();
  }

  @Get(':id')
  get(@Param('id', id) workflowId: string) {
    return this.workflows.get(workflowId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createWorkflowBodySchema))
    input: CreateWorkflowBody,
  ) {
    return this.workflows.create(input);
  }

  @Put(':id')
  @HttpCode(204)
  update(@Param('id', id) workflowId: string, @Body(body) input: WorkflowBody) {
    return this.workflows.update(workflowId, input);
  }

  @Patch(':id/failure-workflow')
  @HttpCode(204)
  setFailureWorkflow(
    @Param('id', id) workflowId: string,
    @Body(new ZodValidationPipe(failureWorkflowBodySchema))
    input: FailureWorkflowBody,
  ) {
    return this.workflows.setFailureWorkflow(workflowId, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', id) workflowId: string) {
    return this.workflows.remove(workflowId);
  }
}
