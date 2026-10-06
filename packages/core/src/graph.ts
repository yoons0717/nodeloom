import { z } from 'zod';

// 저장된 그래프 JSON의 형식 버전. 형식이 바뀌면 올리고, 새 설정 항목은 zod 기본값으로 채운다(DECISIONS B-8).
export const GRAPH_SCHEMA_VERSION = 1;

// 다른 노드가 `$nodes.<key>`로 가리키는 참조 키(DECISIONS 3-4).
export const NODE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

// 오류 문구는 설정 패널에 그대로 보이므로 칸마다 한국어로 적는다.
const triggerConfig = z.object({
  cron: z.string().nullable().default(null),
  testInput: z.json({ error: 'JSON 값이어야 합니다' }).default({}),
});

const intRange = (min: number, max: number) =>
  z
    .number({ error: '숫자를 입력하세요' })
    .int({ error: '정수로 입력하세요' })
    .min(min, { error: `${min}~${max} 사이로 입력하세요` })
    .max(max, { error: `${min}~${max} 사이로 입력하세요` });

const httpConfig = z.object({
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
});

const expressionConfig = z.object({
  expression: z
    .string({ error: '식을 입력하세요' })
    .min(1, { error: '식을 입력하세요' }),
});

export const NODE_SPECS = {
  trigger: { inputs: [], outputs: ['out'], config: triggerConfig },
  http: { inputs: ['in'], outputs: ['out'], config: httpConfig },
  transform: { inputs: ['in'], outputs: ['out'], config: expressionConfig },
  condition: {
    inputs: ['in'],
    outputs: ['true', 'false'],
    config: expressionConfig,
  },
} as const;

export type NodeType = keyof typeof NODE_SPECS;
export type NodeConfig<T extends NodeType> = z.output<
  (typeof NODE_SPECS)[T]['config']
>;

export const nodeTypeSchema = z.enum(
  Object.keys(NODE_SPECS) as [NodeType, ...NodeType[]],
);

// 저장은 초안도 허용하므로(DECISIONS 7-5) 그래프 구조만 엄격히 보고, 노드 설정은 validateGraph가 따로 검사한다.
export const nodeSchema = z.object({
  id: z.string().min(1),
  key: z.string(),
  type: nodeTypeSchema,
  title: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.string(), z.unknown()),
});

const portRefSchema = z.object({
  node: z.string().min(1),
  port: z.string().min(1),
});

export const edgeSchema = z.object({
  id: z.string().min(1),
  from: portRefSchema,
  to: portRefSchema,
});

export const graphSchema = z.object({
  schemaVersion: z.number().int().positive(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export type GraphNode = z.output<typeof nodeSchema>;
export type GraphEdge = z.output<typeof edgeSchema>;
export type PortRef = z.output<typeof portRefSchema>;
export type Graph = z.output<typeof graphSchema>;

// 새 노드의 참조 키: `<type>_<n>`에서 비어 있는 가장 작은 n.
export function nextNodeKey(graph: Graph, type: NodeType): string {
  const used = new Set(graph.nodes.map((n) => n.key));
  let n = 1;
  while (used.has(`${type}_${n}`)) n++;
  return `${type}_${n}`;
}
