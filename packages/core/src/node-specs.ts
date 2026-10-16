import { z } from 'zod';
import { isValidCron } from './cron.js';
import { NODE_PORTS, type NodeType } from './graph.js';

// 오류 문구는 설정 패널에 그대로 보이므로 칸마다 한국어로 적는다.
const triggerConfig = z.object({
  cron: z
    .string()
    .refine(isValidCron, {
      error: 'cron 식이 올바르지 않습니다(분 시 일 월 요일, 5자리)',
    })
    .nullable()
    .default(null),
  testInput: z.json({ error: 'JSON 값이어야 합니다' }).default({}),
});

const intRange = (min: number, max: number) =>
  z
    .number({ error: '숫자를 입력하세요' })
    .int({ error: '정수로 입력하세요' })
    .min(min, { error: `${min}~${max} 사이로 입력하세요` })
    .max(max, { error: `${min}~${max} 사이로 입력하세요` });

const httpConfig = z
  .object({
    method: z
      .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
        error: '지원하지 않는 메서드입니다',
      })
      .default('GET'),
    url: z
      .string({ error: 'URL을 입력하세요' })
      .min(1, { error: 'URL을 입력하세요' }),
    query: z.record(z.string(), z.string()).default({}),
    headers: z.record(z.string(), z.string()).default({}),
    // 객체를 만드는 JSONata 식. 비어 있으면 본문 없음(DECISIONS A-3).
    body: z.string().default(''),
    timeoutSec: intRange(1, 30).default(10),
    retry: intRange(0, 5).default(0),
    continueOnNon2xx: z.boolean().default(false),
  })
  // fetch는 GET 요청에 본문을 실을 수 없어 실행할 때마다 실패한다.
  .refine((c) => !(c.method === 'GET' && c.body.trim()), {
    path: ['body'],
    error:
      'GET 요청에는 본문을 넣을 수 없습니다. 메서드를 POST 등으로 바꾸세요',
  });

const expressionConfig = z.object({
  expression: z
    .string({ error: '식을 입력하세요' })
    .min(1, { error: '식을 입력하세요' }),
});

export const NODE_SPECS = {
  trigger: { ...NODE_PORTS.trigger, config: triggerConfig },
  http: { ...NODE_PORTS.http, config: httpConfig },
  transform: { ...NODE_PORTS.transform, config: expressionConfig },
  condition: { ...NODE_PORTS.condition, config: expressionConfig },
} as const satisfies Record<NodeType, unknown>;

export type NodeConfig<T extends NodeType> = z.output<
  (typeof NODE_SPECS)[T]['config']
>;
