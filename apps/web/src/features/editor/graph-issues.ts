import { type Graph, type Issue, validateGraph } from '@nodeloom/core';

export type GraphIssues = { byNode: Map<string, Issue[]>; graphLevel: Issue[] };

// 같은 그래프 객체는 한 번만 검사한다. 캔버스와 상단 바가 같은 결과를 나눠 쓴다.
// 그래프는 바뀔 때마다 새 객체가 되므로(불변 갱신) 이전 결과가 섞일 일이 없고, 안 쓰는 결과는 WeakMap이 자동으로 버린다.
const cache = new WeakMap<Graph, GraphIssues>();

// 검사 결과는 노드 위치와 상관없다. 노드 1000개 검사 한 번이 한 프레임(16ms)쯤 걸리므로,
// 드래그처럼 위치만 바뀐 그래프는 직전 결과를 그대로 쓴다(M9). 다른 에디터의 그래프면 비교에서 걸러진다.
let last: { graph: Graph; result: GraphIssues } | undefined;

function onlyPositionsChanged(a: Graph, b: Graph) {
  return (
    a.edges === b.edges &&
    a.nodes.length === b.nodes.length &&
    a.nodes.every((n, i) => {
      const m = b.nodes[i]!;
      return (
        n === m ||
        (n.id === m.id &&
          n.key === m.key &&
          n.type === m.type &&
          n.config === m.config)
      );
    })
  );
}

export function getGraphIssues(graph: Graph): GraphIssues {
  const cached = cache.get(graph);
  if (cached) return cached;
  if (last && onlyPositionsChanged(last.graph, graph)) {
    cache.set(graph, last.result);
    last = { graph, result: last.result };
    return last.result;
  }
  const byNode = new Map<string, Issue[]>();
  const graphLevel: Issue[] = [];
  for (const issue of validateGraph(graph)) {
    if (issue.nodeId)
      byNode.set(issue.nodeId, [...(byNode.get(issue.nodeId) ?? []), issue]);
    else if (!issue.edgeId) graphLevel.push(issue);
  }
  const result = { byNode, graphLevel };
  cache.set(graph, result);
  last = { graph, result };
  return result;
}
