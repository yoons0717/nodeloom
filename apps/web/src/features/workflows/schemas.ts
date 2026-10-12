import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

export const meSchema = z.object({ role: z.enum(['admin', 'demo']) });

export const workflowListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    nodeCount: z.number(),
    cron: z.string().nullable(),
    // 사이드바 상태 점과 실행 수(M6 6-g)
    lastRun: z
      .object({
        status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
        finishedAt: z.string().nullable(),
      })
      .nullable(),
    runCount: z.number(),
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
