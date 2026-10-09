'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';
import { type RunStatus, runStartSchema, runStatusSchema } from './schemas';

const isDone = (s?: RunStatus) =>
  s?.status === 'SUCCESS' || s?.status === 'FAILED';

function label(s: RunStatus) {
  switch (s.status) {
    case 'PENDING':
      return '실행 대기 중…';
    case 'RUNNING':
      return '실행 중…';
    case 'SUCCESS':
      return '실행 성공';
    case 'FAILED':
      return `실행 실패: ${s.error?.message ?? '알 수 없는 오류'}`;
  }
}

// 실행 버튼과 상단 바의 실행 상태(M4 작은 결정 ⑥). 저장되지 않은 변경이 있으면 먼저 저장한다(⑦).
export function RunControls({
  workflowId,
  ensureSaved,
}: {
  workflowId: string;
  ensureSaved: () => Promise<boolean>;
}) {
  const [runId, setRunId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async () => {
      // 저장 실패 사유는 저장 상태 칸에 나온다.
      if (!(await ensureSaved())) return null;
      return runStartSchema.parse(
        await clientApi(`/workflows/${workflowId}/runs`, { method: 'POST' }),
      ).runId;
    },
    onMutate: () => setRunId(null),
    onSuccess: setRunId,
  });

  // 끝날 때까지 1초마다 상태만 조회한다(DECISIONS B-1).
  const status = useQuery({
    queryKey: ['run-status', runId],
    queryFn: async () =>
      runStatusSchema.parse(await clientApi(`/runs/${runId}/status`)),
    enabled: runId !== null,
    refetchInterval: (q) => (isDone(q.state.data) ? false : 1000),
  });

  const busy =
    start.isPending ||
    (runId !== null && !isDone(status.data) && !status.error);
  const error = start.error ?? status.error;
  const text = start.isPending
    ? '실행 요청 중…'
    : error
      ? error.message
      : status.data
        ? label(status.data)
        : runId
          ? '실행 대기 중…'
          : '';
  const failed = error || status.data?.status === 'FAILED';

  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => start.mutate()} disabled={busy}>
        실행
      </Button>
      <span
        role="status"
        className={`text-xs ${failed ? 'text-destructive-text' : 'text-muted-foreground'}`}
      >
        {text}
      </span>
    </div>
  );
}
