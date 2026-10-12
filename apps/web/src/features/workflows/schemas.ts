import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

export const meSchema = z.object({ role: z.enum(['admin', 'demo']) });

export const workflowListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    nodeCount: z.number(),
    cron: z.string().nullable(),
    // 사이드바 상태 표시: 마지막 실행과 24시간 안의 실패 수(M6 6-g)
    lastRun: z
      .object({
        status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
        finishedAt: z.string().nullable(),
      })
      .nullable(),
    failedLast24h: z.number(),
    updatedAt: z.string(),
  }),
);

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  graph: graphSchema,
  failureWorkflowId: z.string().nullable(),
});

export type Workflow = z.output<typeof workflowSchema>;
