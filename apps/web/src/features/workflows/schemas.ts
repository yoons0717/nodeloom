import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

export const meSchema = z.object({ role: z.enum(['admin', 'demo']) });

export const workflowListSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    nodeCount: z.number(),
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
