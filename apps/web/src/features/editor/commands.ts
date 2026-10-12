import {
  type Graph,
  type GraphEdge,
  type GraphNode,
  GRAPH_SCHEMA_VERSION,
  type NodeType,
  nextNodeKey,
} from '@nodeloom/core';
import { NODE_META } from './node-meta';

// 그래프 변경 하나. apply로 바꾸고 revert로 정확히 되돌린다(DECISIONS 4-4).
// 되돌리는 데 필요한 값(지운 노드, 이전 값 등)은 커맨드를 만들 때 미리 담아 둔다.
export type Command = {
  label: string;
  apply: (graph: Graph) => Graph;
  revert: (graph: Graph) => Graph;
  // 같은 mergeKey의 커맨드가 짧은 간격으로 이어지면 Undo 한 번에 되돌아가도록 합친다(연속 타이핑).
  mergeKey?: string;
};

type Position = GraphNode['position'];

export function createInitialGraph(): Graph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: [
      newNode(
        { schemaVersion: GRAPH_SCHEMA_VERSION, nodes: [], edges: [] },
        'trigger',
        { x: 0, y: 0 },
      ),
    ],
    edges: [],
  };
}

export function newNode(
  graph: Graph,
  type: NodeType,
  position: Position,
): GraphNode {
  const key = nextNodeKey(graph, type);
  return {
    id: crypto.randomUUID(),
    key,
    type,
    title: NODE_META[type].defaultTitle,
    position,
    config: {},
  };
}

export function addNode(node: GraphNode): Command {
  return {
    label: '노드 추가',
    apply: (g) => ({ ...g, nodes: [...g.nodes, node] }),
    revert: (g) => ({ ...g, nodes: g.nodes.filter((n) => n.id !== node.id) }),
  };
}

export type NodeMove = { id: string; from: Position; to: Position };

export function moveNodes(moves: NodeMove[]): Command {
  const place = (g: Graph, pick: (m: NodeMove) => Position) => {
    const byId = new Map(moves.map((m) => [m.id, pick(m)]));
    return {
      ...g,
      nodes: g.nodes.map((n) =>
        byId.has(n.id) ? { ...n, position: byId.get(n.id)! } : n,
      ),
    };
  };
  return {
    label: '노드 이동',
    apply: (g) => place(g, (m) => m.to),
    revert: (g) => place(g, (m) => m.from),
  };
}

export function connect(edge: GraphEdge): Command {
  return {
    label: '연결',
    apply: (g) => ({ ...g, edges: [...g.edges, edge] }),
    revert: (g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edge.id) }),
  };
}

// 지운 항목을 원래 자리(배열 순서)에 되돌려 놓는다. 순서가 바뀌면 화면의 겹침 순서와 저장 결과가 달라진다.
function reinsert<T>(list: T[], removed: { index: number; item: T }[]): T[] {
  const next = [...list];
  for (const { index, item } of [...removed].sort((a, b) => a.index - b.index))
    next.splice(index, 0, item);
  return next;
}

function collect<T>(list: T[], pick: (item: T) => boolean) {
  return list.flatMap((item, index) => (pick(item) ? [{ index, item }] : []));
}

export function deleteEdges(graph: Graph, edgeIds: string[]): Command {
  return deleteElements(graph, [], edgeIds);
}

export function deleteNodes(graph: Graph, nodeIds: string[]): Command {
  return deleteElements(graph, nodeIds, []);
}

// 선택한 노드와 연결을 한 번에 지운다(Undo 한 번에 되돌아감). 노드를 지우면 붙어 있던 연결도 함께 지운다.
// 되돌릴 때 노드와 연결을 원래 자리로 복원한다.
export function deleteElements(
  graph: Graph,
  nodeIds: string[],
  edgeIds: string[],
): Command {
  const nodes = new Set(nodeIds);
  const edges = new Set(edgeIds);
  const removedNodes = collect(graph.nodes, (n) => nodes.has(n.id));
  const removedEdges = collect(
    graph.edges,
    (e) => edges.has(e.id) || nodes.has(e.from.node) || nodes.has(e.to.node),
  );
  const removedEdgeIds = new Set(removedEdges.map((r) => r.item.id));
  return {
    label: nodeIds.length ? '노드 삭제' : '연결 삭제',
    apply: (g) => ({
      ...g,
      nodes: g.nodes.filter((n) => !nodes.has(n.id)),
      edges: g.edges.filter((e) => !removedEdgeIds.has(e.id)),
    }),
    revert: (g) => ({
      ...g,
      nodes: reinsert(g.nodes, removedNodes),
      edges: reinsert(g.edges, removedEdges),
    }),
  };
}

function patchNode(
  g: Graph,
  id: string,
  patch: (n: GraphNode) => GraphNode,
): Graph {
  return { ...g, nodes: g.nodes.map((n) => (n.id === id ? patch(n) : n)) };
}

export function updateConfig(
  graph: Graph,
  nodeId: string,
  field: string,
  value: unknown,
): Command {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const had = node ? field in node.config : false;
  const previous = node?.config[field];
  return {
    label: '설정 변경',
    mergeKey: `config:${nodeId}:${field}`,
    apply: (g) =>
      patchNode(g, nodeId, (n) => ({
        ...n,
        config: { ...n.config, [field]: value },
      })),
    revert: (g) =>
      patchNode(g, nodeId, (n) => {
        const config = { ...n.config };
        if (had) config[field] = previous;
        else delete config[field];
        return { ...n, config };
      }),
  };
}

export function renameNode(
  graph: Graph,
  nodeId: string,
  field: 'title' | 'key',
  value: string,
): Command {
  const previous = graph.nodes.find((n) => n.id === nodeId)?.[field] ?? '';
  return {
    label: field === 'title' ? '제목 변경' : '참조 키 변경',
    mergeKey: `${field}:${nodeId}`,
    apply: (g) => patchNode(g, nodeId, (n) => ({ ...n, [field]: value })),
    revert: (g) => patchNode(g, nodeId, (n) => ({ ...n, [field]: previous })),
  };
}

// 연속 타이핑 합치기: 앞 커맨드의 되돌리기와 뒤 커맨드의 적용을 이어 붙인다.
export function mergeCommands(first: Command, second: Command): Command {
  return {
    label: second.label,
    mergeKey: second.mergeKey,
    apply: second.apply,
    revert: first.revert,
  };
}
