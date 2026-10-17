import Link from 'next/link';
import { formatDateTime, formatTime } from '@/features/workflows/format';
import { cn } from '@/lib/utils';
import { Elapsed } from './elapsed';
import { formatDuration, RUN_KIND_LABEL, RUN_STATUS_LABEL } from './format';
import {
  EMPTY_FILTER_MESSAGE,
  groupRunsByDay,
  type RunFilter,
  RUN_FILTERS,
} from './run-list';
import type { RunListItem } from './schemas';
import {
  RUN_STATUS_DOT,
  STATUS_TEXT,
  StatusDot,
  type StatusTone,
} from './status-dot';

// API가 돌려주는 최대 개수(M5 작은 결정 ③)
const LIMIT = 50;

// 거르기 칩의 점. "전체"에는 점이 없다.
const FILTER_DOT: Partial<Record<RunFilter, StatusTone>> = {
  failed: 'fail',
  success: 'ok',
  running: 'run',
};

type Run = RunListItem & { workflow?: { id: string; name: string } };

// 워크플로우 하나의 실행 기록과 모든 실행이 함께 쓰는 목록: 상태 거르기 칩, 날짜별 묶음, 행.
// runs는 서버가 상태로 거른 최근 50건이다(?status=). 그래서 칩에는 개수를 붙이지 않는다.
// workflowId가 없으면(모든 실행) 행마다 워크플로우 이름을 보여 준다.
export function RunHistory({
  runs,
  filter,
  basePath,
  workflowId,
}: {
  runs: Run[];
  filter: RunFilter;
  basePath: string;
  workflowId?: string;
}) {
  const groups = groupRunsByDay(runs, new Date());
  return (
    <>
      <nav aria-label="상태 거르기" className="flex flex-wrap gap-2">
        {RUN_FILTERS.map((f) => {
          const on = f.value === filter;
          const dot = FILTER_DOT[f.value];
          return (
            <Link
              key={f.value}
              href={
                f.value === 'all' ? basePath : `${basePath}?status=${f.value}`
              }
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center gap-2 rounded-full border px-3 text-body-sm pointer-coarse:h-11',
                on
                  ? 'border-accent bg-accent-soft text-foreground'
                  : 'border-border-control text-label hover:bg-raised-hover',
              )}
            >
              {dot && <StatusDot tone={dot} />}
              {f.label}
            </Link>
          );
        })}
      </nav>
      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {filter !== 'all' && EMPTY_FILTER_MESSAGE[filter]}
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-xs font-medium text-label">
              {g.label}
              <span className="font-normal text-muted-foreground">
                {g.runs.length}건
              </span>
            </h2>
            <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border bg-surface">
              {g.runs.map((r) => (
                <li key={r.id}>
                  <RunRow run={r} workflowId={workflowId} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {/* TODO: API에 페이지 나눔이 생기면 "더 보기"로 바꾼다(지금은 최근 50건만 온다). */}
      {runs.length >= LIMIT && (
        <p className="text-center text-xs text-muted-foreground">
          최근 {LIMIT}건만 보여 줍니다
        </p>
      )}
    </>
  );
}

// 상태(점 + 글자) | 시각 | 방식(모든 실행은 워크플로우 이름 · 방식) | 걸린 시간 | › 고정 열.
// sm(640) 미만은 두 줄: 1줄 배지 · 시각 · (오른쪽) 걸린 시간 · ›, 2줄 워크플로우 이름 · 방식(DESIGN.md 반응형).
// 실패 행은 오류 두 줄.
function RunRow({ run: r, workflowId }: { run: Run; workflowId?: string }) {
  const at = r.startedAt ?? r.createdAt;
  const wid = workflowId ?? r.workflow?.id;
  return (
    <Link
      href={`/w/${wid}/runs/${r.id}`}
      className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[84px_44px_minmax(0,1fr)_auto_16px] hover:bg-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring focus-visible:ring-inset"
    >
      <span
        className={cn(
          'flex items-center gap-2 text-xs',
          STATUS_TEXT[RUN_STATUS_DOT[r.status]],
        )}
      >
        <StatusDot tone={RUN_STATUS_DOT[r.status]} />
        {RUN_STATUS_LABEL[r.status]}
      </span>
      <span className="font-mono text-xs text-label" title={formatDateTime(at)}>
        {formatTime(at)}
      </span>
      <span className="col-span-5 row-start-2 truncate text-xs text-muted-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1">
        {!workflowId && r.workflow && (
          <>
            <span className="text-body-sm font-bold text-foreground">
              {r.workflow.name}
            </span>
            {' · '}
          </>
        )}
        {RUN_KIND_LABEL[r.kind]}
      </span>
      <span className="col-start-4 row-start-1 text-right font-mono text-xs text-muted-foreground">
        {/* 대기 중은 왼쪽 상태 글자가 이미 말해 주므로 비워 둔다. */}
        {r.status === 'PENDING' ? null : r.status === 'RUNNING' &&
          r.startedAt ? (
          <Elapsed since={r.startedAt} />
        ) : (
          formatDuration(r.startedAt, r.finishedAt)
        )}
      </span>
      <span
        aria-hidden
        className="col-start-5 row-start-1 text-muted-foreground"
      >
        ›
      </span>
      {r.error && (
        <span className="col-span-5 line-clamp-2 text-xs text-danger-text sm:col-span-4 sm:col-start-2">
          {r.error.message}
        </span>
      )}
    </Link>
  );
}
