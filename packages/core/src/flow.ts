import type { Graph } from './graph.js';

export type NodeRunStatus =
  'pending' | 'running' | 'success' | 'failed' | 'skipped';

// port: Condition 노드가 성공했을 때 어느 출력 포트('true' | 'false')로 나갔는지.
export type NodeRunState = { status: NodeRunStatus; port?: string };

export type Decision = 'run' | 'skip' | 'wait';

type ParentOutcome = 'unfinished' | 'success' | 'failed' | 'skipped';

function parentOutcomes(
  nodeId: string,
  graph: Graph,
  states: Record<string, NodeRunState>,
) {
  return graph.edges
    .filter((e) => e.to.node === nodeId)
    .map((e): { parentId: string; outcome: ParentOutcome } => {
      const s = states[e.from.node];
      if (!s || s.status === 'pending' || s.status === 'running')
        return { parentId: e.from.node, outcome: 'unfinished' };
      if (s.status !== 'success')
        return { parentId: e.from.node, outcome: s.status };
      // Condition에서 선택되지 않은 포트로 온 연결은 SKIPPED로 취급한다.
      if (s.port !== undefined && s.port !== e.from.port)
        return { parentId: e.from.node, outcome: 'skipped' };
      return { parentId: e.from.node, outcome: 'success' };
    });
}

// 부모들의 상태를 보고 이 노드를 실행할지, 건너뛸지, 더 기다릴지 판정한다.
// - 부모가 없으면(Trigger) 실행
// - 부모가 하나라도 끝나지 않았으면 기다림
// - 실패한 부모가 있으면 건너뜀: 실패한 노드의 하위 노드는 SKIPPED
// - 성공한 부모가 하나 이상이면 실행, 아니면 건너뜀
export function decideNode(
  nodeId: string,
  graph: Graph,
  states: Record<string, NodeRunState>,
): Decision {
  const outcomes = parentOutcomes(nodeId, graph, states);
  if (outcomes.length === 0) return 'run';
  if (outcomes.some((o) => o.outcome === 'unfinished')) return 'wait';
  if (outcomes.some((o) => o.outcome === 'failed')) return 'skip';
  return outcomes.some((o) => o.outcome === 'success') ? 'run' : 'skip';
}

// 노드의 입력(루트). 부모가 하나면 그 출력, 여럿이면 성공한 부모만 { 참조키: 출력 }.
// 부모가 없는 Trigger의 입력은 실행 엔진이 실행 종류에 따라 넣는다.
export function buildInput(
  nodeId: string,
  graph: Graph,
  states: Record<string, NodeRunState>,
  outputs: Record<string, unknown>,
): unknown {
  const outcomes = parentOutcomes(nodeId, graph, states);
  const parentIds = [...new Set(outcomes.map((o) => o.parentId))];
  if (parentIds.length === 0) return undefined;

  const succeeded = new Set(
    outcomes.filter((o) => o.outcome === 'success').map((o) => o.parentId),
  );
  if (parentIds.length === 1)
    return succeeded.has(parentIds[0]!) ? outputs[parentIds[0]!] : undefined;

  const keyOf = new Map(graph.nodes.map((n) => [n.id, n.key]));
  return Object.fromEntries(
    parentIds
      .filter((id) => succeeded.has(id))
      .map((id) => [keyOf.get(id) ?? id, outputs[id]]),
  );
}
