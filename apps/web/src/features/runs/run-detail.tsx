'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Background,
  Controls,
  type Edge,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { useState } from 'react';
import { type CanvasNode, NodeCard } from '@/features/editor/node-card';
import { formatDateTime } from '@/features/workflows/format';
import { clientApi } from '@/lib/client-api';
import {
  formatDuration,
  NODE_RUN_STATUS,
  RUN_KIND_LABEL,
  RUN_STATUS_CLASS,
  RUN_STATUS_LABEL,
} from './format';
import { NodeRunPanel } from './node-run-panel';
import { type RunDetail as Run, runProgressSchema } from './schemas';

const nodeTypes = {
  trigger: NodeCard,
  http: NodeCard,
  transform: NodeCard,
  condition: NodeCard,
};
const isDone = (s: Run['status']) => s === 'SUCCESS' || s === 'FAILED';

// 실행 당시 그래프를 읽기 전용으로 그리고 노드별 상태를 겹쳐 보여 준다(M5 작은 결정 ④).
export function RunDetail({ run }: { run: Run }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 끝날 때까지 1초마다 상태만 조회한다(DECISIONS B-1).
  const progress = useQuery({
    queryKey: ['run-progress', run.id],
    queryFn: async () =>
      runProgressSchema.parse(await clientApi(`/runs/${run.id}/status`)),
    initialData: run,
    refetchInterval: (q) =>
      q.state.data && isDone(q.state.data.status) ? false : 1000,
  });
  const p = progress.data;
  const statusOf = new Map(p.nodes.map((n) => [n.nodeId, n.status]));

  const nodes: CanvasNode[] = run.graph.nodes.map((n) => {
    const s = statusOf.get(n.id);
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      data: { node: n, issues: [], runStatus: s && NODE_RUN_STATUS[s] },
      selected: n.id === selectedId,
    };
  });
  const edges: Edge[] = run.graph.edges.map((e) => ({
    id: e.id,
    source: e.from.node,
    sourceHandle: e.from.port,
    target: e.to.node,
    targetHandle: e.to.port,
  }));
  const selected = run.graph.nodes.find((n) => n.id === selectedId);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="h-[50vh] min-w-0 md:h-auto md:flex-1">
        <ReactFlowProvider>
          <ReactFlow<CanvasNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      <aside className="flex w-full flex-col gap-4 border-t border-border bg-surface p-4 md:w-80 md:overflow-y-auto md:border-t-0 md:border-l">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">상태</dt>
          <dd
            role="status"
            className={`font-bold ${RUN_STATUS_CLASS[p.status]}`}
          >
            {RUN_STATUS_LABEL[p.status]}
          </dd>
          <dt className="text-muted-foreground">종류</dt>
          <dd>{RUN_KIND_LABEL[run.kind]}</dd>
          <dt className="text-muted-foreground">시작</dt>
          <dd>{formatDateTime(p.startedAt ?? run.createdAt)}</dd>
          {p.finishedAt && (
            <>
              <dt className="text-muted-foreground">걸린 시간</dt>
              <dd>{formatDuration(p.startedAt, p.finishedAt)}</dd>
            </>
          )}
        </dl>
        {p.error && (
          <div className="text-sm text-destructive-text">
            <p>{p.error.message}</p>
            {p.error.issues && (
              <ul className="mt-1 list-disc pl-4 text-xs">
                {p.error.issues.map((i) => (
                  <li key={i.message}>{i.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <hr className="border-divider" />
        {selected ? (
          <NodeRunPanel
            runId={run.id}
            node={selected}
            status={statusOf.get(selected.id)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            노드를 고르면 받은 값과 내보낸 값을 볼 수 있습니다.
          </p>
        )}
      </aside>
    </div>
  );
}
