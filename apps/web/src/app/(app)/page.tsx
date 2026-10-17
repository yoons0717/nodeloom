import { PageHeader } from '@/components/ui/page-header';
import { DemoBadge } from '@/features/workflows/demo-badge';
import { NewWorkflowButton } from '@/features/workflows/new-workflow-button';
import { meSchema, workflowListSchema } from '@/features/workflows/schemas';
import { WorkflowCards } from '@/features/workflows/workflow-cards';
import { serverApi } from '@/lib/server-api';

// 목록은 서버가 처음 그리고, 카드는 사이드바와 같은 캐시로 상태를 이어 받는다(DECISIONS 4-1).
// 로그인하지 않았으면 serverApi가 /login으로 보낸다.
export default async function WorkflowListPage() {
  const [me, workflows] = await Promise.all([
    serverApi('/auth/me', meSchema),
    serverApi('/workflows', workflowListSchema),
  ]);

  return (
    <>
      <PageHeader
        title="전체 워크플로우"
        status={
          <>
            {workflows.length > 0 && (
              <span className="text-body-sm text-muted-foreground">
                {workflows.length}개
              </span>
            )}
            {me.role === 'demo' && <DemoBadge />}
          </>
        }
        actions={<NewWorkflowButton />}
      />
      <div className="w-full max-w-[1200px] p-6">
        <WorkflowCards initial={workflows} demo={me.role === 'demo'} />
      </div>
    </>
  );
}
