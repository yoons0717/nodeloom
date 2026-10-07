import Link from 'next/link';
import { LogoutButton } from '@/features/auth/logout-button';
import { DeleteWorkflowButton } from '@/features/workflows/delete-workflow-button';
import { formatDateTime } from '@/features/workflows/format';
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Nodeloom</h1>
        {me.role === 'demo' && (
          <span className="rounded-full border border-primary px-2.5 py-0.5 text-xs text-primary">
            데모 · 로그인 없이 누구나 편집할 수 있습니다
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {me.role === 'admin' && <LogoutButton />}
          <NewWorkflowButton />
        </div>
      </header>

      {workflows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          아직 워크플로우가 없습니다. 새로 만들기를 눌러 시작하세요.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider rounded-lg border border-border bg-surface">
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
              <span className="text-xs text-muted-foreground">
                노드 {w.nodeCount}개
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(w.updatedAt)} 수정
              </span>
              <DeleteWorkflowButton id={w.id} name={w.name} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
