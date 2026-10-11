import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatDuration,
  RUN_KIND_LABEL,
  RUN_STATUS_CLASS,
  RUN_STATUS_LABEL,
} from '@/features/runs/format';
import { runListSchema } from '@/features/runs/schemas';
import { formatDateTime } from '@/features/workflows/format';
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">
          {workflow.name} · 실행 기록
        </h1>
        <Link
          href={`/w/${id}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          에디터로
        </Link>
      </header>

      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          아직 실행 기록이 없습니다. 에디터에서 실행하거나 스케줄을 설정하세요.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border bg-surface">
          {runs.map((r) => (
            <li key={r.id}>
              <Link
                href={`/w/${id}/runs/${r.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-raised"
              >
                <span
                  className={`w-14 font-bold ${RUN_STATUS_CLASS[r.status]}`}
                >
                  {RUN_STATUS_LABEL[r.status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {RUN_KIND_LABEL[r.kind]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(r.startedAt ?? r.createdAt)}
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
  );
}
