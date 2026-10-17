import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { RunHistory } from '@/features/runs/run-history';
import { parseRunFilter } from '@/features/runs/run-list';
import { allRunsSchema } from '@/features/runs/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '모든 실행 · Nodeloom' };

// 모든 워크플로우의 최근 실행(M6 6-g). 워크플로우 하나의 실행 기록과 같은 목록에 워크플로우 이름이 붙는다.
export default async function AllRunsPage({
  searchParams,
}: PageProps<'/runs'>) {
  const filter = parseRunFilter((await searchParams).status);
  const runs = await serverApi(
    `/runs${filter === 'all' ? '' : `?status=${filter}`}`,
    allRunsSchema,
  );
  return (
    <>
      <PageHeader title="모든 실행" />
      <div className="flex w-full max-w-[1200px] flex-col gap-6 p-6">
        {filter === 'all' && runs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              아직 실행 기록이 없습니다. 워크플로우를 열어 실행하거나 스케줄을
              설정하세요.
            </p>
            <Button
              variant="outline"
              render={<Link href="/" />}
              nativeButton={false}
            >
              전체 워크플로우
            </Button>
          </div>
        ) : (
          <RunHistory runs={runs} filter={filter} basePath="/runs" />
        )}
      </div>
    </>
  );
}
