'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Background,
  type Edge,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import Link from 'next/link';
// 실행 상세 주소로 바로 들어와도 캔버스가 그려지도록 React Flow 기본 스타일을 여기서도 불러온다.
import '@xyflow/react/dist/style.css';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { InlineError } from '@/components/ui/inline-error';
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
import { firstFailedNodeId, RunTimeline } from './run-timeline';
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
  // 실패한 실행은 처음 실패한 노드를 고른 채 연다(M6 6-f).
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    firstFailedNodeId(run.nodes),
  );

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
  // 실행이 끝나면 사이드바의 상태 점·실행 수·실패 배지를 새로 불러온다(M6 6-g).
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!done) return;
    void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    void queryClient.invalidateQueries({ queryKey: ['run-summary'] });
  }, [done, queryClient]);
  const nodeRuns = new Map(p.nodes.map((n) => [n.nodeId, n]));
  // 캔버스 아래에 쌓인 배치(lg 미만)에서는 노드를 고르면 패널 맨 위로 올린다(RESPONSIVE 4-4).
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (panel.current && !window.matchMedia('(min-width: 1024px)').matches)
      panel.current.scrollTop = 0;
  }, [selectedId]);

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
      {/* 실행은 시각으로 부른다(M6 작은 결정 ③). 뒤로 가기 하나만 둔다(M6 6-f). */}
      <PageHeader
        context={workflowName}
        title={`${formatRunTime(run.createdAt)} 실행`}
        status={
          <Badge tone={RUN_STATUS_TONE[p.status]} role="status">
            {RUN_STATUS_LABEL[p.status]}
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            className="pointer-coarse:h-11"
            render={<Link href={`/w/${run.workflowId}`} />}
            nativeButton={false}
          >
            <span className="md:hidden">에디터</span>
            <span className="hidden md:inline">에디터에서 열기</span>
          </Button>
        }
      />
      {/* 좁은 화면에서도 사라지지 않도록 머리글 아래 한 줄로 둔다. */}
      <p className="border-b border-border-subtle bg-surface px-4 py-2 text-xs text-muted-foreground">
        {summary.join(' · ')}
      </p>
      {/* lg 미만은 캔버스 아래에 패널을 쌓고 패널만 스크롤한다. md – lg는 패널을 두 칸으로 나눈다(RESPONSIVE 4-4). */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-[45svh] min-h-64 min-w-0 shrink-0 lg:h-auto lg:flex-1 lg:shrink">
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
        <aside
          ref={panel}
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-t border-border-subtle bg-surface md:grid md:grid-cols-2 md:content-start lg:flex lg:w-80 lg:flex-none lg:overflow-visible lg:border-t-0 lg:border-l xl:w-96"
        >
          <div className="md:max-lg:border-r md:max-lg:border-border-subtle">
            {p.error && (
              <InlineError
                className="border-b border-border-subtle p-4"
                message={p.error.message}
                issues={p.error.issues}
              />
            )}
            <RunTimeline
              graph={run.graph}
              nodes={p.nodes}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          {selected ? (
            <NodeRunPanel
              key={selected.id}
              runId={run.id}
              node={selected}
              status={nodeRuns.get(selected.id)?.status}
              runError={p.error?.message}
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
