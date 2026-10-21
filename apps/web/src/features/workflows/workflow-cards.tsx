'use client';

import { isValidCron, nextCronRuns } from '@nodeloom/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { z } from 'zod';
import {
  describeSchedule,
  parseSchedule,
} from '@/features/editor/settings/schedule';
import {
  STATUS_TEXT,
  StatusDot,
  type StatusTone,
} from '@/features/runs/status-dot';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRunTime, TIMEZONE } from './format';
import { NewWorkflowButton } from './new-workflow-button';
import { workflowListSchema } from './schemas';
import { WorkflowRowMenu } from './workflow-row-menu';

type Item = z.output<typeof workflowListSchema>[number];

// 카드 아래 상태 줄의 글자. 마지막 실행과 24시간 안의 실패 수로 만든다.
export function runStatus(w: Pick<Item, 'lastRun' | 'failedLast24h'>): {
  tone: StatusTone;
  text: string;
} {
  const run = w.lastRun;
  if (!run) return { tone: 'none', text: '아직 실행 안 함' };
  const at = run.finishedAt ? ` · ${formatRunTime(run.finishedAt)}` : '';
  switch (run.status) {
    case 'FAILED':
      return {
        tone: 'fail',
        text: `실패${at}${w.failedLast24h > 1 ? ` · 24시간 ${w.failedLast24h}회` : ''}`,
      };
    case 'SUCCESS':
      return {
        tone: 'ok',
        text: `성공${at}${w.failedLast24h ? ` · 24시간 ${w.failedLast24h}회 실패` : ''}`,
      };
    case 'RUNNING':
      return { tone: 'run', text: '실행 중' };
    case 'PENDING':
      return { tone: 'pending', text: '대기 중' };
  }
}

// 전체 워크플로우 카드 격자. 사이드바와 같은 캐시를 써서 실행 상태가 바뀌면 함께 바뀐다(M6 6-g).
export function WorkflowCards({
  initial,
  demo,
}: {
  initial: Item[];
  demo: boolean;
}) {
  const { data } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () =>
      workflowListSchema.parse(await clientApi('/workflows')),
    initialData: initial,
  });

  if (data.length === 0)
    return (
      <div className="flex min-h-41 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
        <span className="text-[15px] font-bold">
          아직 워크플로우가 없습니다
        </span>
        <span className="text-body-sm text-muted-foreground">
          첫 워크플로우를 만들어 보세요.
        </span>
        <NewWorkflowButton />
      </div>
    );

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {data.map((w) => {
        const status = runStatus(w);
        return (
          <li
            key={w.id}
            className="group/card relative flex min-h-41 flex-col rounded-lg border border-border bg-surface hover:border-border-control hover:bg-raised has-[[data-popup-open]]:border-border-control has-[[data-popup-open]]:bg-raised"
          >
            <div className="flex items-start gap-1 pt-3 pr-2 pl-4">
              {/* 카드 전체를 누르면 에디터로 간다. ⋯ 메뉴와 상태 줄만 그 위에 둔다. */}
              <Link
                href={`/w/${w.id}`}
                className="line-clamp-2 min-w-0 flex-1 pt-[7px] text-[15px]/[22px] font-bold after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-accent-ring"
              >
                {w.name}
              </Link>
              <div className="relative z-10 shrink-0">
                <WorkflowRowMenu
                  workflow={{ id: w.id, name: w.name, cron: w.cron }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 px-4 pt-1.5 pb-3.5 text-xs text-muted-foreground">
              <ScheduleText cron={w.cron} demo={demo} />
              <span>
                노드 {w.nodeCount}개 ·{' '}
                <span title={formatDateTime(w.updatedAt)}>
                  {formatRunTime(w.updatedAt)}
                </span>{' '}
                수정
              </span>
            </div>
            {/* 상태 줄은 모든 카드에서 같은 자리이고, 그 워크플로우의 실행 기록으로 간다. 아래 모서리 7 = 카드 8 − 테두리 1. */}
            <Link
              href={`/w/${w.id}/runs`}
              aria-label={`${w.name} 실행 기록: ${status.text}`}
              className="relative z-[2] mt-auto flex h-11 items-center gap-2 rounded-b-[7px] border-t border-border-subtle pr-3 pl-4 text-xs hover:bg-raised-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-ring"
            >
              <StatusDot tone={status.tone} />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  STATUS_TEXT[status.tone],
                )}
              >
                {status.text}
              </span>
              <span
                aria-hidden
                className="text-sm text-border-control group-hover/card:text-label"
              >
                ›
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// 스케줄이 있으면 반복과 다음 실행 시각을 보여 준다. 데모에서는 스케줄이 돌지 않아 다음 실행은 뺀다.
// 서버가 그린 뒤 다음 실행 시각이 지나가면 브라우저 값이 달라질 수 있어 hydration 경고를 끈다.
function ScheduleText({ cron, demo }: { cron: string | null; demo: boolean }) {
  if (cron === null) return <span>스케줄 없음</span>;
  if (!isValidCron(cron))
    return <span className="text-danger-text">스케줄 오류</span>;
  const next = demo ? null : nextCronRuns(cron, TIMEZONE, 1)[0];
  return (
    <span className="flex min-w-0 gap-1 whitespace-nowrap">
      <span className="text-label">
        {describeSchedule(parseSchedule(cron))}
      </span>
      {next && (
        <span className="truncate" suppressHydrationWarning>
          · 다음 {formatRunTime(next.toISOString())}
        </span>
      )}
    </span>
  );
}
