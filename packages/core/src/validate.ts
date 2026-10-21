import {
  type Graph,
  type GraphNode,
  graphSchema,
  NODE_KEY_PATTERN,
  type PortRef,
} from './graph.js';
import { NODE_SPECS } from './node-specs.js';
import {
  checkExpressionSyntax,
  extractNodeRefs,
  nodeExpressions,
} from './template.js';
import { topoSort } from './topo.js';

export type IssueCode =
  | 'invalid_config'
  | 'invalid_key'
  | 'duplicate_key'
  | 'trigger_count'
  | 'unreachable'
  | 'cycle'
  | 'unknown_node'
  | 'invalid_port'
  | 'self_loop'
  | 'duplicate_edge'
  | 'unknown_ref'
  | 'expression_syntax'
  | 'invalid_graph';

export type Issue = {
  code: IssueCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
  // 노드의 어느 칸 문제인지. 설정 패널이 칸 아래에 오류를 보여 줄 때 쓴다('title', 'key' 또는 설정 이름).
  field?: string;
};

const isOutput = (node: GraphNode, port: string) =>
  (NODE_SPECS[node.type].outputs as readonly string[]).includes(port);
const isInput = (node: GraphNode, port: string) =>
  (NODE_SPECS[node.type].inputs as readonly string[]).includes(port);
const sameEdge = (
  a: { from: PortRef; to: PortRef },
  b: { from: PortRef; to: PortRef },
) =>
  a.from.node === b.from.node &&
  a.from.port === b.from.port &&
  a.to.node === b.to.node &&
  a.to.port === b.to.port;

// DB에 저장된 그래프를 읽고 검사한다. 수동 실행, 스케줄 실행, 실패 알림 실행이 같이 쓴다.
export function checkGraph(
  raw: unknown,
): { ok: true; graph: Graph } | { ok: false; issues: Issue[] } {
  const parsed = graphSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      issues: [
        { code: 'invalid_graph', message: '그래프 형식이 올바르지 않습니다' },
      ],
    };
  const issues = validateGraph(parsed.data);
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, graph: parsed.data };
}

// 그래프 전체를 검사해 문제 목록을 돌려준다. 에디터 배지와 서버의 실행 전 검증이 같이 쓴다.
export function validateGraph(graph: Graph): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const keys = new Set<string>();

  for (const node of graph.nodes) {
    const parsed = NODE_SPECS[node.type].config.safeParse(node.config);
    if (!parsed.success) {
      // 칸마다 첫 오류 하나만 보고한다.
      const seen = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '');
        if (seen.has(field)) continue;
        seen.add(field);
        issues.push({
          code: 'invalid_config',
          nodeId: node.id,
          field: field || undefined,
          message: issue.message,
        });
      }
    }
    if (!NODE_KEY_PATTERN.test(node.key)) {
      issues.push({
        code: 'invalid_key',
        nodeId: node.id,
        field: 'key',
        message: `참조 키 "${node.key}"는 영어 소문자로 시작하고 소문자, 숫자, _만 쓸 수 있습니다`,
      });
    } else if (keys.has(node.key)) {
      issues.push({
        code: 'duplicate_key',
        nodeId: node.id,
        field: 'key',
        message: `참조 키 "${node.key}"가 중복됩니다`,
      });
    }
    keys.add(node.key);
  }

  for (const [i, edge] of graph.edges.entries()) {
    const from = byId.get(edge.from.node);
    const to = byId.get(edge.to.node);
    if (!from || !to) {
      issues.push({
        code: 'unknown_node',
        edgeId: edge.id,
        message: '존재하지 않는 노드에 연결되어 있습니다',
      });
      continue;
    }
    if (!isOutput(from, edge.from.port) || !isInput(to, edge.to.port)) {
      issues.push({
        code: 'invalid_port',
        edgeId: edge.id,
        message: '출력 포트에서 입력 포트로만 연결할 수 있습니다',
      });
    }
    if (from.id === to.id) {
      issues.push({
        code: 'self_loop',
        edgeId: edge.id,
        message: '노드를 자기 자신에 연결할 수 없습니다',
      });
    }
    if (graph.edges.slice(0, i).some((e) => sameEdge(e, edge))) {
      issues.push({
        code: 'duplicate_edge',
        edgeId: edge.id,
        message: '같은 연결이 이미 있습니다',
      });
    }
  }

  const triggers = graph.nodes.filter((n) => n.type === 'trigger');
  if (triggers.length !== 1) {
    issues.push({
      code: 'trigger_count',
      message: `Trigger는 정확히 1개여야 합니다(현재 ${triggers.length}개)`,
    });
  } else {
    const reached = reachableFrom(graph, triggers[0]!.id);
    for (const node of graph.nodes) {
      if (!reached.has(node.id)) {
        issues.push({
          code: 'unreachable',
          nodeId: node.id,
          message: 'Trigger에서 이어지지 않은 노드입니다',
        });
      }
    }
  }

  const sorted = topoSort(graph);
  if (!sorted.ok) {
    for (const nodeId of sorted.cycle) {
      issues.push({
        code: 'cycle',
        nodeId,
        message: '순환 연결에 포함된 노드입니다',
      });
    }
  }

  for (const node of graph.nodes) {
    for (const { field, expression } of nodeExpressions(node)) {
      const syntax = checkExpressionSyntax(expression);
      if (syntax) {
        issues.push({
          code: 'expression_syntax',
          nodeId: node.id,
          field,
          message: `식 문법 오류: ${syntax.message}`,
        });
        continue;
      }
      for (const ref of extractNodeRefs(expression)) {
        if (!keys.has(ref)) {
          issues.push({
            code: 'unknown_ref',
            nodeId: node.id,
            field,
            message: `없는 노드 "${ref}"를 참조합니다`,
          });
        }
      }
    }
  }

  return issues;
}

// 에디터가 선을 끄는 동안 canConnect가 자주 불리므로, 인접 목록을 한 번 만들어 노드·엣지 수에 비례하는 시간에 끝낸다.
function reachableFrom(graph: Graph, startId: string): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = next.get(e.from.node);
    if (list) list.push(e.to.node);
    else next.set(e.from.node, [e.to.node]);
  }
  const seen = new Set([startId]);
  const stack = [startId];
  while (stack.length) {
    for (const to of next.get(stack.pop()!) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        stack.push(to);
      }
    }
  }
  return seen;
}

export type ConnectResult =
  { ok: true } | { ok: false; code: IssueCode; message: string };

// 에디터에서 선을 놓기 전에 연결 가능 여부와 거부 사유를 알려준다(React Flow isValidConnection에 연결).
export function canConnect(
  graph: Graph,
  from: PortRef,
  to: PortRef,
): ConnectResult {
  const a = graph.nodes.find((n) => n.id === from.node);
  const b = graph.nodes.find((n) => n.id === to.node);
  if (!a || !b)
    return {
      ok: false,
      code: 'unknown_node',
      message: '존재하지 않는 노드입니다',
    };
  if (!isOutput(a, from.port) || !isInput(b, to.port)) {
    return {
      ok: false,
      code: 'invalid_port',
      message: '출력 포트에서 입력 포트로만 연결할 수 있습니다',
    };
  }
  if (a.id === b.id)
    return {
      ok: false,
      code: 'self_loop',
      message: '노드를 자기 자신에 연결할 수 없습니다',
    };
  if (graph.edges.some((e) => sameEdge(e, { from, to }))) {
    return {
      ok: false,
      code: 'duplicate_edge',
      message: '같은 연결이 이미 있습니다',
    };
  }
  // 도착 노드에서 출발 노드로 돌아오는 길이 이미 있으면, 이 선이 원을 닫는다.
  if (reachableFrom(graph, b.id).has(a.id)) {
    return {
      ok: false,
      code: 'cycle',
      message: '이 연결을 만들면 순환이 생깁니다',
    };
  }
  return { ok: true };
}
