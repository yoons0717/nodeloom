import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Elapsed } from '@/features/runs/elapsed';
import {
  formatDuration,
  RUN_KIND_LABEL,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
} from '@/features/runs/format';
import {
  EMPTY_FILTER_MESSAGE,
  groupRunsByDay,
  matchesFilter,
  parseRunFilter,
  RUN_FILTERS,
} from '@/features/runs/run-list';
import { type RunListItem, runListSchema } from '@/features/runs/schemas';
import { formatDateTime, formatTime } from '@/features/workflows/format';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: '실행 기록 · Nodeloom' };

// API가 돌려주는 최대 개수(M5 작은 결정 ③)
const LIMIT = 50;

// 읽기 화면이라 서버 컴포넌트로 그리고 좁은 화면에서도 보여 준다(DECISIONS 4-1, B-11).
// 상태 거르기는 주소(?status=)에 두어 새로고침해도 유지한다.
export default async function RunListPage({
  params,
  searchParams,
}: PageProps<'/w/[id]/runs'>) {
  const { id } = await params;
  const filter = parseRunFilter((await searchParams).status);
  const [workflow, runs] = await Promise.all([
    serverApi(`/workflows/${id}`, workflowSchema),
    serverApi(`/workflows/${id}/runs`, runListSchema),
  ]);
  const visible = runs.filter((r) => matchesFilter(r, filter));
  const groups = groupRunsByDay(visible, new Date());

  return (
    <>
      <PageHeader
        back={{ href: `/w/${id}`, label: '에디터' }}
        context={workflow.name}
        title="실행 기록"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 실행 기록이 없습니다. 에디터에서 실행하거나 스케줄을
              설정하세요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button render={<Link href={`/w/${id}`} />} nativeButton={false}>
                <span aria-hidden>▶</span>지금 실행
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/w/${id}`} />}
                nativeButton={false}
              >
                스케줄 설정
              </Button>
            </div>
          </div>
        ) : (
          <>
            <nav aria-label="상태 거르기" className="flex flex-wrap gap-2">
              {RUN_FILTERS.map((f) => {
                const count = runs.filter((r) =>
                  matchesFilter(r, f.value),
                ).length;
                const on = f.value === filter;
                return (
                  <Link
                    key={f.value}
                    href={
                      f.value === 'all' ? `/w/${id}/runs` : `?status=${f.value}`
                    }
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'flex h-8 items-center gap-2 rounded-full border px-3 text-body-sm',
                      on
                        ? 'border-accent bg-accent-soft text-foreground'
                        : 'border-border-control text-label hover:bg-raised-hover',
                    )}
                  >
                    {f.label}
                    <span className="font-mono text-caption text-muted-foreground">
                      {count}
                    </span>
                  </Link>
                );
              })}
            </nav>
            {visible.length === 0 ? (
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
                        <RunRow workflowId={id} run={r} />
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
        )}
      </main>
    </>
  );
}

// 상태 배지 | 시각 | 방식 | 걸린 시간 | › 고정 열. 실패 행은 왼쪽에 빨간 막대와 오류 두 줄.
function RunRow({
  workflowId,
  run: r,
}: {
  workflowId: string;
  run: RunListItem;
}) {
  const at = r.startedAt ?? r.createdAt;
  return (
    <Link
      href={`/w/${workflowId}/runs/${r.id}`}
      className={cn(
        'grid grid-cols-[84px_44px_minmax(0,1fr)_auto_16px] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-raised focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring focus-visible:ring-inset',
        r.status === 'FAILED' && 'shadow-[inset_2px_0_0_var(--danger)]',
      )}
    >
      <Badge tone={RUN_STATUS_TONE[r.status]}>
        {RUN_STATUS_LABEL[r.status]}
      </Badge>
      <span className="font-mono text-xs text-label" title={formatDateTime(at)}>
        {formatTime(at)}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {RUN_KIND_LABEL[r.kind]}
      </span>
      <span className="text-right font-mono text-xs text-muted-foreground">
        {r.status === 'PENDING' ? (
          '대기 중'
        ) : r.status === 'RUNNING' && r.startedAt ? (
          <Elapsed since={r.startedAt} />
        ) : (
          formatDuration(r.startedAt, r.finishedAt)
        )}
      </span>
      <span aria-hidden className="text-muted-foreground">
        ›
      </span>
      {r.error && (
        <span className="col-span-4 col-start-2 line-clamp-2 text-xs text-danger-text">
          {r.error.message}
        </span>
      )}
    </Link>
  );
}
