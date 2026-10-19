'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createInitialGraph } from '@/features/editor/commands';
import { clientApi } from '@/lib/client-api';

// Trigger 하나가 놓인 그래프로 만들고 바로 에디터로 이동한다. 목록 버튼과 사이드바가 같이 쓴다.
// 이름은 보내지 않는다. 서버가 "새 워크플로우", "새 워크플로우 2"…로 붙인다.
export function useCreateWorkflow() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await clientApi('/workflows', {
        method: 'POST',
        body: JSON.stringify({ graph: createInitialGraph() }),
      })) as { id: string },
    onSuccess: ({ id }) => {
      // 사이드바 목록(['workflows'])도 새로 불러온다.
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      // ?new: 에디터가 이름 칸을 골라 둔다(save-controls.tsx).
      router.push(`/w/${id}?new`);
    },
  });
}

export function NewWorkflowButton() {
  const create = useCreateWorkflow();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending ? '만드는 중' : '새 워크플로우'}
      </Button>
      {create.error && (
        <p role="alert" className="text-xs text-danger-text">
          {create.error.message}
        </p>
      )}
    </div>
  );
}
