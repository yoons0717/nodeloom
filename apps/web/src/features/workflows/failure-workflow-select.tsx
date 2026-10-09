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
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      실패하면 실행
      <Select
        value={value}
        onValueChange={(v) => v && save.mutate(v)}
        items={items}
      >
        <SelectTrigger
          className="h-9 w-40"
          aria-label="실패하면 실행할 워크플로우"
        >
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
      {save.error && (
        <span className="text-destructive-text">{save.error.message}</span>
      )}
    </label>
  );
}
