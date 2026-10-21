import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { RunHistory } from '@/features/runs/run-history';
import { parseRunFilter } from '@/features/runs/run-list';
import { runListSchema } from '@/features/runs/schemas';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '실행 기록 · Nodeloom' };

// 읽기 화면이라 서버 컴포넌트로 그리고 좁은 화면에서도 보여 준다.
// 상태 거르기는 주소(?status=)에 두어 새로고침해도 유지한다.
export default async function RunListPage({
  params,
  searchParams,
}: PageProps<'/w/[id]/runs'>) {
  const { id } = await params;
  const filter = parseRunFilter((await searchParams).status);
  const [workflow, runs] = await Promise.all([
    serverApi(`/workflows/${id}`, workflowSchema),
    serverApi(
      `/workflows/${id}/runs${filter === 'all' ? '' : `?status=${filter}`}`,
      runListSchema,
    ),
  ]);

  return (
    <>
      <PageHeader context={workflow.name} title="실행 기록" />
      <div className="flex w-full max-w-[1200px] flex-col gap-6 p-6">
        {filter === 'all' && runs.length === 0 ? (
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
          <RunHistory
            runs={runs}
            filter={filter}
            basePath={`/w/${id}/runs`}
            workflowId={id}
          />
        )}
      </div>
    </>
  );
}
