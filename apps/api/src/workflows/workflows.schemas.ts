import { graphSchema } from '@nodeloom/core';
import { z } from 'zod';

// 저장은 그래프의 뼈대만 검사한다. 설정 오류나 순환이 있는 초안도 저장한다(DECISIONS 7-5).
export const workflowBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: '이름을 입력하세요' })
    .max(100, { error: '이름은 100자까지 쓸 수 있습니다' }),
  graph: graphSchema,
});

export type WorkflowBody = z.output<typeof workflowBodySchema>;
