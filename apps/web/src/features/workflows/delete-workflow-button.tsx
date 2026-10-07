'use client';

import { useMutation } from '@tanstack/react-query';
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
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => clientApi(`/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.refresh(),
  });

  if (!confirming)
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        삭제
      </Button>
    );

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label={`${name} 삭제 확인`}
    >
      <span className="text-xs text-destructive-text">
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
