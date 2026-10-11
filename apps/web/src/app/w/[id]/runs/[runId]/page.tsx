import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunDetail } from '@/features/runs/run-detail';
import { runDetailSchema } from '@/features/runs/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '실행 상세 · Nodeloom' };

// 처음 화면은 서버에서 그리고, 끝나지 않은 실행은 브라우저가 상태만 이어서 조회한다(DECISIONS 4-1, B-1).
export default async function RunDetailPage({
  params,
}: PageProps<'/w/[id]/runs/[runId]'>) {
  const { id, runId } = await params;
  const run = await serverApi(`/runs/${runId}`, runDetailSchema);
  // 다른 워크플로우의 실행을 이 주소로 보여 주지 않는다.
  if (run.workflowId !== id) notFound();

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <h1 className="flex-1 font-bold">실행 상세</h1>
        <Link
          href={`/w/${id}/runs`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          실행 기록
        </Link>
        <Link
          href={`/w/${id}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          에디터로
        </Link>
      </header>
      <RunDetail run={run} />
    </main>
  );
}
