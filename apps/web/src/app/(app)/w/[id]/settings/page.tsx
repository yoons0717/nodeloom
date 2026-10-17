import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { DeleteWorkflowSection } from '@/features/workflows/delete-workflow-dialog';
import { FailureWorkflowSelect } from '@/features/workflows/failure-workflow-select';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '설정 · Nodeloom' };

// 워크플로우 설정(M6 6-g). 지금은 "실패하면 실행" 하나다. 고르면 바로 저장된다.
export default async function WorkflowSettingsPage({
  params,
}: PageProps<'/w/[id]/settings'>) {
  const { id } = await params;
  const workflow = await serverApi(`/workflows/${id}`, workflowSchema);
  const cron = workflow.graph.nodes.find((n) => n.type === 'trigger')?.config
    .cron;
  return (
    <>
      <PageHeader context={workflow.name} title="설정" />
      <div className="flex w-full max-w-[1200px] flex-col gap-6 p-6">
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-base font-bold">실패 알림</h2>
          <FailureWorkflowSelect
            workflowId={workflow.id}
            initial={workflow.failureWorkflowId}
          />
        </section>
        <DeleteWorkflowSection
          workflow={{
            id: workflow.id,
            name: workflow.name,
            cron: typeof cron === 'string' ? cron : null,
          }}
        />
      </div>
    </>
  );
}
