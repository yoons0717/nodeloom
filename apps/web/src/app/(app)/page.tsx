import { isValidCron, nextCronRuns } from '@nodeloom/core';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import {
  describeSchedule,
  parseSchedule,
} from '@/features/editor/settings/schedule';
import { DeleteWorkflowButton } from '@/features/workflows/delete-workflow-button';
import { DemoBadge } from '@/features/workflows/demo-badge';
import {
  formatDateTime,
  formatRunTime,
  TIMEZONE,
} from '@/features/workflows/format';
import { NewWorkflowButton } from '@/features/workflows/new-workflow-button';
import { meSchema, workflowListSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';
import { cn } from '@/lib/utils';

// 목록은 서버 컴포넌트로 그린다(DECISIONS 4-1). 로그인하지 않았으면 serverApi가 /login으로 보낸다.
export default async function WorkflowListPage() {
  const [me, workflows] = await Promise.all([
    serverApi('/auth/me', meSchema),
    serverApi('/workflows', workflowListSchema),
  ]);

  return (
    <>
      <PageHeader
        title="Nodeloom"
        status={me.role === 'demo' && <DemoBadge />}
        actions={
          <>
            <NewWorkflowButton />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        {workflows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            아직 워크플로우가 없습니다. 새로 만들기를 눌러 시작하세요.
          </p>
        ) : (
          // 열을 행끼리 맞추려고 목록이 grid를 갖고 행은 subgrid로 따른다. md 미만에서는 이름 아래로 접는다.
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
            {workflows.map((w) => (
              <li
                key={w.id}
                className="group relative flex flex-col gap-1 px-4 py-3 hover:bg-raised md:col-span-5 md:grid md:grid-cols-subgrid md:items-center md:gap-x-4"
              >
                {/* 행 전체를 누를 수 있게 링크가 행을 덮는다. 삭제 버튼만 그 위에 둔다. */}
                <Link
                  href={`/w/${w.id}`}
                  className="truncate font-bold after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-accent-ring"
                >
                  {w.name}
                </Link>
                {/* TODO: 마지막 실행 상태는 목록 API에 없어서 보여 주지 않는다(M6 6-f). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
                  {/* 넓은 화면에서는 열을 맞추려고 빈 칸도 두고, 좁은 화면에서는 스케줄이 없으면 자리를 차지하지 않는다. */}
                  <span
                    className={cn(
                      'md:block md:text-right',
                      !w.cron && 'hidden',
                    )}
                  >
                    <ScheduleText cron={w.cron} demo={me.role === 'demo'} />
                  </span>
                  <span className="text-xs text-muted-foreground md:text-right">
                    노드 {w.nodeCount}개
                  </span>
                  <span
                    className="text-xs text-muted-foreground md:text-right"
                    title={formatDateTime(w.updatedAt)}
                  >
                    {formatRunTime(w.updatedAt)} 수정
                  </span>
                </div>
                {/* 넓은 화면에서는 마우스를 올리거나 포커스가 있을 때만 보인다. 터치 화면(좁은 화면)에서는 늘 보인다. */}
                <div className="relative z-10 -ml-2.5 self-start md:ml-0 md:self-auto md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-confirming]]:opacity-100">
                  <DeleteWorkflowButton id={w.id} name={w.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// 스케줄이 있는 워크플로우만 반복과 다음 실행 시각을 보여 준다. 데모에서는 스케줄이 돌지 않아 다음 실행은 뺀다(DECISIONS D-3).
function ScheduleText({ cron, demo }: { cron: string | null; demo: boolean }) {
  if (cron === null) return null;
  if (!isValidCron(cron))
    return <span className="text-xs text-danger-text">스케줄 오류</span>;
  const next = demo ? null : nextCronRuns(cron, TIMEZONE, 1)[0];
  return (
    <span className="text-xs text-muted-foreground">
      {describeSchedule(parseSchedule(cron))}
      {next && ` · 다음 ${formatRunTime(next.toISOString())}`}
    </span>
  );
}
