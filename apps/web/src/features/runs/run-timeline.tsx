'use client';

import type { Graph } from '@nodeloom/core';
import { PORT_LABEL } from '@/features/editor/node-meta';
import { cn } from '@/lib/utils';
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

function formatMs(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

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
  const rows = nodes
    .filter((r) => titleOf.has(r.nodeId))
    .toSorted(
      (a, b) =>
        Date.parse(a.startedAt ?? '9999') - Date.parse(b.startedAt ?? '9999'),
    );
  const total = rows.reduce((sum, r) => sum + (durationOf(r) ?? 0), 0);

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-subtle px-2 py-3">
      <h2 className="px-2 pb-1 text-xs font-medium text-label">실행 순서</h2>
      {rows.map((r) => {
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
              'grid h-7 grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-left text-body-sm hover:bg-raised-hover',
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
            <span
              className={cn(
                'flex items-center gap-1.5 font-mono text-caption font-normal',
                on ? 'text-label' : 'text-muted-foreground',
              )}
            >
              {skipped ? (
                '건너뜀'
              ) : (
                <>
                  {share > 0.5 && (
                    <span className="block h-1 w-10 overflow-hidden rounded-full bg-border">
                      <span
                        className="block h-full bg-warning"
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </span>
                  )}
                  {r.port && `${PORT_LABEL[r.port] ?? r.port} · `}
                  {ms !== undefined && formatMs(ms)}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
