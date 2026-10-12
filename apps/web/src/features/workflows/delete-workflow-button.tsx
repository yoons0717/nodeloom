'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

// 실수로 지우지 않도록 화면 안에서 한 번 더 확인한다(M3 작은 결정 ⑧).
export function DeleteWorkflowButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => clientApi(`/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 사이드바 목록도 다시 불러온다(M6 6-g).
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      router.refresh();
    },
  });

  // 목록 행 전체가 링크라서 이 안의 클릭이 행으로 번지지 않게 막는다.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (!confirming)
    return (
      <Button
        variant="ghost"
        aria-label={`${name} 삭제`}
        onClick={(e) => {
          stop(e);
          setConfirming(true);
        }}
      >
        삭제
      </Button>
    );

  return (
    <div
      data-confirming
      className="flex items-center gap-2"
      role="group"
      aria-label={`${name} 삭제 확인`}
      onClick={stop}
    >
      <span className="text-xs text-danger-text">
        {remove.error ? remove.error.message : '정말 삭제할까요?'}
      </span>
      <Button
        variant="destructive"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
      >
        삭제
      </Button>
      <Button variant="outline" onClick={() => setConfirming(false)}>
        취소
      </Button>
    </div>
  );
}
