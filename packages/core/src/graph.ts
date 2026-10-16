import { z } from 'zod';

// 저장된 그래프 JSON의 형식 버전. 형식이 바뀌면 올리고, 새 설정 항목은 zod 기본값으로 채운다(DECISIONS B-8).
export const GRAPH_SCHEMA_VERSION = 1;

// 다른 노드가 `$nodes.<key>`로 가리키는 참조 키(DECISIONS 3-4).
export const NODE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

// 노드 종류. 종류별 포트와 설정 규칙은 node-specs.ts의 NODE_SPECS에 있다.
// 그래프 모양 검사(graphSchema)가 설정 규칙(cron 해석기 등)을 끌어오지 않도록 목록을 따로 둔다(M9).
export const NODE_TYPES = [
  'trigger',
  'http',
  'transform',
  'condition',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// 노드 종류별 입력·출력 포트. 노드 카드처럼 포트만 필요한 곳이 설정 규칙 없이 쓸 수 있게 따로 둔다.
export const NODE_PORTS = {
  trigger: { inputs: [], outputs: ['out'] },
  http: { inputs: ['in'], outputs: ['out'] },
  transform: { inputs: ['in'], outputs: ['out'] },
  condition: { inputs: ['in'], outputs: ['true', 'false'] },
} as const satisfies Record<NodeType, unknown>;

export const nodeTypeSchema = z.enum(NODE_TYPES);

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
