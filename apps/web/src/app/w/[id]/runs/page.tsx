import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import {
  formatDuration,
  RUN_KIND_LABEL,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
} from '@/features/runs/format';
import { runListSchema } from '@/features/runs/schemas';
import { formatDateTime, formatRunTime } from '@/features/workflows/format';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '실행 기록 · Nodeloom' };

// 읽기 화면이라 서버 컴포넌트로 그리고 좁은 화면에서도 보여 준다(DECISIONS 4-1, B-11).
export default async function RunListPage({
  params,
}: PageProps<'/w/[id]/runs'>) {
  const { id } = await params;
  const [workflow, runs] = await Promise.all([
    serverApi(`/workflows/${id}`, workflowSchema),
    serverApi(`/workflows/${id}/runs`, runListSchema),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: `/w/${id}`, label: '에디터' }}
        context={workflow.name}
        title="실행 기록"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        {runs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            아직 실행 기록이 없습니다. 에디터에서 실행하거나 스케줄을
            설정하세요.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/w/${id}/runs/${r.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-raised"
                >
                  <Badge tone={RUN_STATUS_TONE[r.status]}>
                    {RUN_STATUS_LABEL[r.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {RUN_KIND_LABEL[r.kind]}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={formatDateTime(r.startedAt ?? r.createdAt)}
                  >
                    {formatRunTime(r.startedAt ?? r.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(r.startedAt, r.finishedAt)}
                  </span>
                  {r.error && (
                    <span className="w-full truncate text-xs text-danger-text">
                      {r.error.message}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
