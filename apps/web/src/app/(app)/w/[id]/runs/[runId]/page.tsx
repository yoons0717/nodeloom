import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RunDetail } from '@/features/runs/run-detail';
import { runDetailSchema } from '@/features/runs/schemas';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '실행 상세 · Nodeloom' };

// 처음 화면은 서버에서 그리고, 끝나지 않은 실행은 브라우저가 상태만 이어서 조회한다.
export default async function RunDetailPage({
  params,
}: PageProps<'/w/[id]/runs/[runId]'>) {
  const { id, runId } = await params;
  const [run, workflow] = await Promise.all([
    serverApi(`/runs/${runId}`, runDetailSchema),
    serverApi(`/workflows/${id}`, workflowSchema),
  ]);
  // 다른 워크플로우의 실행을 이 주소로 보여 주지 않는다.
  if (run.workflowId !== id) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RunDetail run={run} workflowName={workflow.name} />
    </div>
  );
}
