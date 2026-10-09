import { z } from 'zod';

export const runStartSchema = z.object({ runId: z.string() });

// 상태와 시간만 온다(DECISIONS B-1).
export const runStatusSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
  error: z.object({ message: z.string() }).nullable(),
});

export type RunStatus = z.output<typeof runStatusSchema>;
