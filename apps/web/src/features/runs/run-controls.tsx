'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
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
      return '실행 실패';
  }
}

// 실행 버튼과 실행 결과 토스트(M4 작은 결정 ⑥, M6). 저장되지 않은 변경이 있으면 먼저 저장한다(M4 ⑦).
export function RunControls({
  workflowId,
  ensureSaved,
}: {
  workflowId: string;
  ensureSaved: () => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const start = useMutation({
    mutationFn: async () => {
      // 저장 실패 사유는 저장 상태 칸에 나온다.
      if (!(await ensureSaved())) return null;
      return runStartSchema.parse(
        await clientApi(`/workflows/${workflowId}/runs`, { method: 'POST' }),
      ).runId;
    },
    onMutate: () => {
      setRunId(null);
      setDismissed(false);
    },
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
  const failed = Boolean(error) || status.data?.status === 'FAILED';
  // 실패는 첫 줄 "실행 실패", 둘째 줄 사유로 나눈다(M6 6-f).
  const reason = error
    ? error.message
    : status.data?.status === 'FAILED'
      ? (status.data.error?.message ?? '알 수 없는 오류')
      : null;
  const succeeded = status.data?.status === 'SUCCESS';

  // 실행이 끝나면 사이드바의 상태 점·실행 수·실패 배지를 새로 불러온다(M6 6-g).
  const finished = isDone(status.data);
  useEffect(() => {
    if (!finished) return;
    void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    void queryClient.invalidateQueries({ queryKey: ['run-summary'] });
  }, [finished, queryClient]);

  // 성공은 잠시 뒤 저절로 닫고, 실패는 직접 닫을 때까지 남긴다(M6 작은 결정 ⑥).
  useEffect(() => {
    if (!succeeded) return;
    const t = setTimeout(() => setDismissed(true), 4000);
    return () => clearTimeout(t);
  }, [succeeded]);

  return (
    <div className="relative">
      <Button onClick={() => start.mutate()} disabled={busy}>
        {busy ? (
          '실행 중…'
        ) : (
          <>
            <span aria-hidden>▶</span>실행
          </>
        )}
      </Button>
      {text && !dismissed && (
        <div className="absolute top-full right-0 z-50 mt-2 flex w-72 flex-col gap-1 rounded-md border border-border bg-overlay px-3 py-2 text-xs shadow-md">
          <div className="flex items-start gap-3">
            {failed ? (
              <InlineError
                role="status"
                className="flex-1 text-xs font-bold"
                message="실행 실패"
              />
            ) : (
              <span role="status" className="flex-1 text-foreground">
                {text}
              </span>
            )}
            {failed && (
              <button
                type="button"
                aria-label="닫기"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setDismissed(true)}
              >
                ×
              </button>
            )}
          </div>
          {reason && (
            <p className="line-clamp-3 break-words text-foreground">{reason}</p>
          )}
          {/* 시작하자마자 보여 준다. 끝난 뒤에만 보이면 실행이 멈췄을 때 볼 방법이 없다. */}
          {runId && (
            <Link
              href={`/w/${workflowId}/runs/${runId}`}
              className="self-end text-accent hover:underline"
            >
              결과 보기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
