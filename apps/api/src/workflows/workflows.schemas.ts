import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

// 저장은 그래프의 뼈대만 검사한다. 설정 오류나 순환이 있는 초안도 저장한다.
const nameSchema = z
  .string()
  .trim()
  .min(1, { error: '이름을 입력하세요' })
  .max(100, { error: '이름은 100자까지 쓸 수 있습니다' });

export const workflowBodySchema = z.object({
  name: nameSchema,
  graph: graphSchema,
});

export type WorkflowBody = z.output<typeof workflowBodySchema>;

// 만들 때는 이름을 비워도 된다. 비우면 서버가 "새 워크플로우"에 번호를 붙인다(M10 10-a).
export const createWorkflowBodySchema = z.object({
  name: nameSchema.optional(),
  graph: graphSchema,
});

export type CreateWorkflowBody = z.output<typeof createWorkflowBodySchema>;

// 실패하면 실행할 워크플로우. null이면 해제
export const failureWorkflowBodySchema = z.object({
  failureWorkflowId: z.uuid({ error: '워크플로우 id가 아닙니다' }).nullable(),
});

export type FailureWorkflowBody = z.output<typeof failureWorkflowBodySchema>;
