import { isValidCron, nextCronRuns } from '@nodeloom/core';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  describeSchedule,
  parseSchedule,
} from '@/features/editor/settings/schedule';
import { LogoutButton } from '@/features/auth/logout-button';
import { DeleteWorkflowButton } from '@/features/workflows/delete-workflow-button';
import {
  formatDateTime,
  formatRunTime,
  TIMEZONE,
} from '@/features/workflows/format';
import { NewWorkflowButton } from '@/features/workflows/new-workflow-button';
import { meSchema, workflowListSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

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
        status={
          me.role === 'demo' && (
            <Badge>데모 · 로그인 없이 누구나 편집할 수 있습니다</Badge>
          )
        }
        actions={
          <>
            {me.role === 'admin' && <LogoutButton />}
            <NewWorkflowButton />
          </>
        }
      />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        {workflows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            아직 워크플로우가 없습니다. 새로 만들기를 눌러 시작하세요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
            {workflows.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Link
                  href={`/w/${w.id}`}
                  className="min-w-0 flex-1 truncate font-bold hover:text-primary"
                >
                  {w.name}
                </Link>
                <ScheduleText cron={w.cron} demo={me.role === 'demo'} />
                <span className="text-xs text-muted-foreground">
                  노드 {w.nodeCount}개
                </span>
                <span
                  className="text-xs text-muted-foreground"
                  title={formatDateTime(w.updatedAt)}
                >
                  마지막 수정 {formatRunTime(w.updatedAt)}
                </span>
                <DeleteWorkflowButton id={w.id} name={w.name} />
              </li>
            ))}
          </ul>
        )}
      </main>
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
