import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

export const runStartSchema = z.object({ runId: z.string() });

const runStatusValue = z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']);
// 검사 오류로 실행하지 않은 경우(INVALID_GRAPH)에는 무엇이 틀렸는지 issues가 함께 온다.
const runError = z
  .object({
    message: z.string(),
    issues: z.array(z.object({ message: z.string() })).optional(),
  })
  .nullable();

// 상태와 시간만 온다(DECISIONS B-1).
export const runStatusSchema = z.object({
  status: runStatusValue,
  error: runError,
});

export type RunStatus = z.output<typeof runStatusSchema>;

export const runListSchema = z.array(
  z.object({
    id: z.string(),
    status: runStatusValue,
    kind: z.enum(['MANUAL', 'SCHEDULE', 'FAILURE']),
    error: runError,
    createdAt: z.string(),
    startedAt: z.string().nullable(),
    finishedAt: z.string().nullable(),
  }),
);

export type RunListItem = z.output<typeof runListSchema>[number];

export const nodeRunStatusSchema = z.enum([
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
]);
export type NodeRunStatus = z.output<typeof nodeRunStatusSchema>;

// 상태 조회(1초 폴링)의 전체 응답. 노드마다 마지막 시도의 상태만 온다(DECISIONS B-1).
export const runProgressSchema = runStatusSchema.extend({
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  nodes: z.array(
    z.object({
      nodeId: z.string(),
      status: nodeRunStatusSchema,
      attempt: z.number(),
      port: z.string().nullable(),
      startedAt: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
  ),
});
export type RunProgress = z.output<typeof runProgressSchema>;

export const runDetailSchema = runProgressSchema.extend({
  id: z.string(),
  workflowId: z.string(),
  kind: z.enum(['MANUAL', 'SCHEDULE', 'FAILURE']),
  createdAt: z.string(),
  graph: graphSchema,
});
export type RunDetail = z.output<typeof runDetailSchema>;

export const nodeAttemptsSchema = z.array(
  z.object({
    attempt: z.number(),
    status: nodeRunStatusSchema,
    port: z.string().nullable(),
    input: z.unknown(),
    output: z.unknown(),
    error: z.object({ message: z.string() }).nullable(),
  }),
);

// 모든 워크플로우의 실행(GET /runs). 행에 워크플로우 이름을 함께 보여 준다(M6 6-g).
export const allRunsSchema = z.array(
  runListSchema.element.extend({
    workflow: z.object({ id: z.string(), name: z.string() }),
  }),
);

export const runSummarySchema = z.object({
  failedLast24h: z.number(),
  running: z.number(),
});
