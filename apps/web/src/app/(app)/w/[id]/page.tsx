import type { Metadata } from 'next';
import { WorkflowEditor } from '@/features/workflows/workflow-editor';
import { workflowSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = { title: '에디터 · Nodeloom' };

// 서버에서 그래프를 불러와 클라이언트 에디터에 넘긴다(DECISIONS 4-1). 없는 id면 serverApi가 404 화면을 띄운다.
export default async function WorkflowPage({ params }: PageProps<'/w/[id]'>) {
  const { id } = await params;
  const workflow = await serverApi(`/workflows/${id}`, workflowSchema);
  return <WorkflowEditor workflow={workflow} />;
}
