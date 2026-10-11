'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createInitialGraph } from '@/features/editor/commands';
import { clientApi } from '@/lib/client-api';

const NEW_NAME = '새 워크플로우';

// Trigger 하나가 놓인 그래프로 만들고 바로 에디터로 이동한다.
export function NewWorkflowButton() {
  const router = useRouter();
  const create = useMutation({
    mutationFn: async () =>
      (await clientApi('/workflows', {
        method: 'POST',
        body: JSON.stringify({ name: NEW_NAME, graph: createInitialGraph() }),
      })) as { id: string },
    onSuccess: ({ id }) => router.push(`/w/${id}`),
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending ? '만드는 중…' : '새로 만들기'}
      </Button>
      {create.error && (
        <p role="alert" className="text-xs text-danger-text">
          {create.error.message}
        </p>
      )}
    </div>
  );
}
