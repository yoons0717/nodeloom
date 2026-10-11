'use client';

import type { GraphNode } from '@nodeloom/core';
import { useQuery } from '@tanstack/react-query';
import { ApiError, clientApi } from '@/lib/client-api';
import { NODE_RUN_STATUS } from './format';
import { type NodeRunStatus, nodeAttemptsSchema } from './schemas';

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <pre className="max-h-64 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-[11px] whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

// 고른 노드의 시도별 입력·출력·오류. 입출력은 크기가 커서 폴링에 넣지 않고 고를 때 받는다(DECISIONS B-1).
export function NodeRunPanel({
  runId,
  node,
  status,
}: {
  runId: string;
  node: GraphNode;
  // 상태가 바뀌면(진행 중 → 끝) 다시 받는다.
  status: NodeRunStatus | undefined;
}) {
  const attempts = useQuery({
    queryKey: ['node-attempts', runId, node.id, status],
    queryFn: async () =>
      nodeAttemptsSchema.parse(
        await clientApi(`/runs/${runId}/nodes/${node.id}`),
      ),
    retry: false,
  });

  const notRun =
    attempts.error instanceof ApiError && attempts.error.status === 404;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-bold">{node.title}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {node.key}
        </p>
      </div>
      {notRun ? (
        <p className="text-sm text-muted-foreground">
          이 노드는 실행되지 않았습니다.
        </p>
      ) : attempts.error ? (
        <p className="text-sm text-danger-text">{attempts.error.message}</p>
      ) : !attempts.data ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : (
        attempts.data.map((a) => (
          <section key={a.attempt} className="flex flex-col gap-2">
            {attempts.data.length > 1 && (
              <p className="text-xs font-bold">
                {a.attempt}번째 시도 · {NODE_RUN_STATUS[a.status].label}
              </p>
            )}
            {a.error && (
              <p className="text-sm text-danger-text">{a.error.message}</p>
            )}
            <Json label="입력" value={a.input} />
            <Json label="출력" value={a.output} />
          </section>
        ))
      )}
    </div>
  );
}
