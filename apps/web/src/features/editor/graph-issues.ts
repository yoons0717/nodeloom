import { type Graph, type Issue, validateGraph } from '@nodeloom/core';

export type GraphIssues = { byNode: Map<string, Issue[]>; graphLevel: Issue[] };

// 같은 그래프 객체는 한 번만 검사한다. 캔버스와 상단 바가 같은 결과를 나눠 쓴다.
// 그래프는 바뀔 때마다 새 객체가 되므로(불변 갱신) 이전 결과가 섞일 일이 없고, 안 쓰는 결과는 WeakMap이 자동으로 버린다.
const cache = new WeakMap<Graph, GraphIssues>();

export function getGraphIssues(graph: Graph): GraphIssues {
  const cached = cache.get(graph);
  if (cached) return cached;
  const byNode = new Map<string, Issue[]>();
  const graphLevel: Issue[] = [];
  for (const issue of validateGraph(graph)) {
    if (issue.nodeId)
      byNode.set(issue.nodeId, [...(byNode.get(issue.nodeId) ?? []), issue]);
    else if (!issue.edgeId) graphLevel.push(issue);
  }
  const result = { byNode, graphLevel };
  cache.set(graph, result);
  return result;
}
