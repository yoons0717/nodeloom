import type { Graph } from './graph.js';

export type TopoResult =
  { ok: true; order: string[] } | { ok: false; cycle: string[] };

// 화살표 방향을 지킨 노드 순서(Kahn 알고리즘). 실행 순서(DECISIONS 7-1)와 순환 검사에 쓴다.
export function topoSort(graph: Graph): TopoResult {
  const ids = graph.nodes.map((n) => n.id);
  const next = new Map(ids.map((id) => [id, [] as string[]]));
  const indegree = new Map(ids.map((id) => [id, 0]));

  for (const e of graph.edges) {
    const targets = next.get(e.from.node);
    if (!targets || !indegree.has(e.to.node)) continue; // 없는 노드로의 연결은 validateGraph가 따로 보고한다
    targets.push(e.to.node);
    indegree.set(e.to.node, indegree.get(e.to.node)! + 1);
  }

  const queue = ids.filter((id) => indegree.get(id) === 0);
  const order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const to of next.get(id)!) {
      const left = indegree.get(to)! - 1;
      indegree.set(to, left);
      if (left === 0) queue.push(to);
    }
  }
  if (order.length === ids.length) return { ok: true, order };

  // 남은 노드에는 순환에 걸린 노드와 그 뒤에 매달린 노드가 섞여 있다.
  // 뒤쪽에서 나가는 화살표가 없는 노드를 반복해서 걷어 내면 순환에 걸린 노드만 남는다.
  const left = new Set(ids.filter((id) => indegree.get(id)! > 0));
  let peeled = true;
  while (peeled) {
    peeled = false;
    for (const id of left) {
      if (!next.get(id)!.some((to) => left.has(to))) {
        left.delete(id);
        peeled = true;
      }
    }
  }
  return { ok: false, cycle: ids.filter((id) => left.has(id)) };
}
