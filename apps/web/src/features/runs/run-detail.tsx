'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Background,
  type Edge,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CanvasControls } from '@/features/editor/canvas-controls';
import { type CanvasNode, NodeCard } from '@/features/editor/node-card';
import { formatRunTime } from '@/features/workflows/format';
import { clientApi } from '@/lib/client-api';
import {
  formatDuration,
  RUN_KIND_LABEL,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
} from './format';
import { NodeRunPanel } from './node-run-panel';
import { RunTimeline } from './run-timeline';
import { type RunDetail as Run, runProgressSchema } from './schemas';

const nodeTypes = {
  trigger: NodeCard,
  http: NodeCard,
  transform: NodeCard,
  condition: NodeCard,
};
const isDone = (s: Run['status']) => s === 'SUCCESS' || s === 'FAILED';

// 실행 당시 그래프를 읽기 전용으로 그리고 노드별 상태를 겹쳐 보여 준다(M5 작은 결정 ④).
export function RunDetail({
  run,
  workflowName,
}: {
  run: Run;
  workflowName: string;
}) {
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
  const done = isDone(p.status);
  const nodeRuns = new Map(p.nodes.map((n) => [n.nodeId, n]));

  const nodes: CanvasNode[] = run.graph.nodes.map((n) => {
    const r = nodeRuns.get(n.id);
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        node: n,
        issues: [],
        run: r && {
          status: r.status,
          port: r.port ?? undefined,
          durationMs:
            r.startedAt && r.finishedAt
              ? Date.parse(r.finishedAt) - Date.parse(r.startedAt)
              : undefined,
        },
      },
      selected: n.id === selectedId,
    };
  });
  // 지나간 연결선은 청록, 실행이 끝났는데 지나가지 않은 갈래는 점선(데모).
  const edges: Edge[] = run.graph.edges.map((e) => {
    const from = nodeRuns.get(e.from.node);
    const passed =
      from?.status === 'SUCCESS' && (from.port ?? e.from.port) === e.from.port;
    return {
      id: e.id,
      source: e.from.node,
      sourceHandle: e.from.port,
      target: e.to.node,
      targetHandle: e.to.port,
      style: passed
        ? { stroke: 'var(--edge-active)' }
        : done
          ? { stroke: 'var(--edge-inactive)', strokeDasharray: '5 5' }
          : undefined,
    };
  });
  const selected = run.graph.nodes.find((n) => n.id === selectedId);
  const summary = [
    RUN_KIND_LABEL[run.kind],
    formatRunTime(p.startedAt ?? run.createdAt),
    formatDuration(p.startedAt, p.finishedAt),
  ].filter(Boolean);

  return (
    <>
      {/* 에디터와 같은 56px 머리글(데모). 실행은 시각으로 부른다(M6 작은 결정 ③). */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-4">
        <Link
          href={`/w/${run.workflowId}/runs`}
          aria-label="실행 기록으로"
          className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-md text-base text-muted-foreground hover:bg-raised-hover hover:text-foreground"
        >
          ←
        </Link>
        <h1 className="flex min-w-0 items-center gap-2 text-base">
          <span className="truncate text-muted-foreground">{workflowName}</span>
          <span aria-hidden className="text-disabled">
            /
          </span>
          <span className="shrink-0 font-bold">
            {formatRunTime(run.createdAt)} 실행
          </span>
        </h1>
        <Badge tone={RUN_STATUS_TONE[p.status]} role="status">
          {RUN_STATUS_LABEL[p.status]}
        </Badge>
        <span className="hidden truncate text-xs text-muted-foreground md:inline">
          {summary.join(' · ')}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            className="hidden md:inline-flex"
            render={<Link href={`/w/${run.workflowId}/runs`} />}
            nativeButton={false}
          >
            실행 기록
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/w/${run.workflowId}`} />}
            nativeButton={false}
          >
            에디터에서 열기
          </Button>
        </div>
      </header>
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
              <CanvasControls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        <aside className="flex min-h-0 w-full flex-col border-t border-border-subtle bg-surface md:w-80 md:border-t-0 md:border-l">
          {p.error && (
            <div className="border-b border-border-subtle p-4 text-sm text-danger-text">
              <p>
                <span aria-hidden>! </span>
                {p.error.message}
              </p>
              {p.error.issues && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {p.error.issues.map((i) => (
                    <li key={i.message}>{i.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <RunTimeline
            graph={run.graph}
            nodes={p.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          {selected ? (
            <NodeRunPanel
              key={selected.id}
              runId={run.id}
              node={selected}
              status={nodeRuns.get(selected.id)?.status}
            />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              노드를 고르면 받은 값과 내보낸 값을 볼 수 있습니다.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
