'use client';

import type { Graph } from '@nodeloom/core';
import { PORT_LABEL } from '@/features/editor/node-meta';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatMs } from './format';
import type { RunProgress } from './schemas';

type NodeRunRow = RunProgress['nodes'][number];

const GLYPH: Record<
  NodeRunRow['status'],
  { glyph: string; className: string }
> = {
  SUCCESS: { glyph: '✓', className: 'text-success' },
  FAILED: { glyph: '!', className: 'text-danger-text' },
  RUNNING: { glyph: '●', className: 'text-accent' },
  SKIPPED: { glyph: '–', className: '' },
};

const durationOf = (r: NodeRunRow) =>
  r.startedAt && r.finishedAt
    ? Date.parse(r.finishedAt) - Date.parse(r.startedAt)
    : undefined;

// 시작한 순서. 아직 시작하지 않은 노드는 맨 뒤로.
export function orderNodeRuns(nodes: NodeRunRow[]) {
  return nodes.toSorted(
    (a, b) =>
      Date.parse(a.startedAt ?? '9999') - Date.parse(b.startedAt ?? '9999'),
  );
}

// 실패한 실행을 열었을 때 처음 고를 노드(가장 먼저 실패한 노드).
export function firstFailedNodeId(nodes: NodeRunRow[]) {
  return (
    orderNodeRuns(nodes).find((r) => r.status === 'FAILED')?.nodeId ?? null
  );
}

// 노드가 이보다 많으면 실행 순서를 처음부터 접어 둔다(M6 6-f).
const COLLAPSE_OVER = 8;

// 실행 순서(데모): 노드가 시작한 순서대로 상태·제목·걸린 시간. 전체의 절반을 넘긴 노드는 경고 막대로 표시한다.
export function RunTimeline({
  graph,
  nodes,
  selectedId,
  onSelect,
}: {
  graph: Graph;
  nodes: NodeRunRow[];
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const titleOf = new Map(graph.nodes.map((n) => [n.id, n.title]));
  const rows = orderNodeRuns(nodes.filter((r) => titleOf.has(r.nodeId)));
  const [open, setOpen] = useState(rows.length <= COLLAPSE_OVER);
  const total = rows.reduce((sum, r) => sum + (durationOf(r) ?? 0), 0);

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-subtle px-2 py-3">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-md px-2 pb-1 text-left text-xs font-medium text-label hover:text-foreground"
          onClick={() => setOpen(!open)}
        >
          {/* 행의 상태 글리프 칸(16px)과 같은 너비라 "실행 순서"가 행 제목과 같은 줄에서 시작한다. */}
          <span aria-hidden className="w-4 shrink-0">
            {open ? '▾' : '▸'}
          </span>
          실행 순서
          <span className="font-normal text-muted-foreground">
            {rows.length}
          </span>
        </button>
      </h2>
      {open &&
        rows.map((r) => {
          const ms = durationOf(r);
          const skipped = r.status === 'SKIPPED';
          const share = ms !== undefined && total > 0 ? ms / total : 0;
          const on = r.nodeId === selectedId;
          return (
            <button
              key={r.nodeId}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(r.nodeId)}
              className={cn(
                // 막대와 시간은 고정 너비 열이라 행마다 같은 자리에 선다.
                'grid h-7 grid-cols-[16px_minmax(0,1fr)_40px_64px] items-center gap-2 rounded-md px-2 text-left text-body-sm hover:bg-raised-hover',
                on && 'bg-accent-soft font-bold',
                skipped && 'text-muted-foreground',
              )}
            >
              <span
                aria-hidden
                className={cn('text-caption', GLYPH[r.status].className)}
              >
                {GLYPH[r.status].glyph}
              </span>
              <span className="truncate">{titleOf.get(r.nodeId)}</span>
              {/* 모든 행에 비율 막대, 전체의 절반을 넘긴 노드만 경고색(M6 6-f). 건너뛴 행은 막대 없이. */}
              <span className="block h-1 overflow-hidden rounded-full bg-border">
                {!skipped && (
                  <span
                    className={cn(
                      'block h-full',
                      share > 0.5 ? 'bg-warning' : 'bg-accent',
                    )}
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                )}
              </span>
              <span
                className={cn(
                  'truncate text-right font-mono text-caption font-normal',
                  on ? 'text-label' : 'text-muted-foreground',
                )}
              >
                {skipped
                  ? '건너뜀'
                  : `${r.port ? `${PORT_LABEL[r.port] ?? r.port} · ` : ''}${ms !== undefined ? formatMs(ms) : ''}`}
              </span>
            </button>
          );
        })}
    </div>
  );
}
