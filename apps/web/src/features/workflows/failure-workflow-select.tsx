'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clientApi } from '@/lib/client-api';
import { workflowListSchema } from './schemas';

const NONE = 'none';

// 이 워크플로우가 실패하면 실행할 워크플로우(DECISIONS 7-4). 고르면 바로 저장한다.
export function FailureWorkflowSelect({
  workflowId,
  initial,
}: {
  workflowId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? NONE);
  const list = useQuery({
    queryKey: ['workflows'],
    queryFn: async () =>
      workflowListSchema.parse(await clientApi('/workflows')),
  });
  const save = useMutation({
    mutationFn: (next: string) =>
      clientApi(`/workflows/${workflowId}/failure-workflow`, {
        method: 'PATCH',
        body: JSON.stringify({
          failureWorkflowId: next === NONE ? null : next,
        }),
      }),
    onMutate: (next) => {
      const prev = value;
      setValue(next);
      return prev;
    },
    onError: (_e, _next, prev) => prev && setValue(prev),
  });

  const items = [
    { value: NONE, label: '없음' },
    ...(list.data ?? [])
      .filter((w) => w.id !== workflowId)
      .map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    // 상단 바의 "설정" 팝오버 안에 둔다(M6). 한 번 정하면 잘 바꾸지 않는 설정이라서다.
    <div className="flex w-64 flex-col gap-1">
      <span className="text-xs font-medium text-label">실패하면 실행</span>
      <Select
        value={value}
        onValueChange={(v) => v && save.mutate(v)}
        items={items}
      >
        <SelectTrigger aria-label="실패하면 실행할 워크플로우">
          {/* 목록을 불러오기 전에는 id 대신 안내를 보여 준다. */}
          <SelectValue>
            {(v: string) =>
              items.find((i) => i.value === v)?.label ?? '불러오는 중…'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span
        className={`text-xs ${save.error ? 'text-danger-text' : 'text-muted-foreground'}`}
      >
        {save.error ? (
          <>
            <span aria-hidden>! </span>
            {save.error.message}
          </>
        ) : (
          '이 워크플로우가 실패하면 고른 워크플로우를 실행합니다'
        )}
      </span>
    </div>
  );
}
