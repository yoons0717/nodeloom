'use client';

import type { GraphNode } from '@nodeloom/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { NODE_RUN_LABEL } from './format';
import { type JsonPath, JsonView, toExpression } from './json-view';
import { type NodeRunStatus, nodeAttemptsSchema } from './schemas';

const TAB =
  'flex h-7 items-center rounded-sm px-3 text-body-sm text-muted-foreground';
const TAB_ON = 'bg-raised-hover font-medium text-foreground';

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
  const [tab, setTab] = useState<'input' | 'output'>('output');
  const [attemptNo, setAttemptNo] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ path: JsonPath; value: unknown }>();
  const [copied, setCopied] = useState(false);
  const attempts = useQuery({
    queryKey: ['node-attempts', runId, node.id, status],
    queryFn: async () =>
      nodeAttemptsSchema.parse(
        await clientApi(`/runs/${runId}/nodes/${node.id}`),
      ),
    retry: false,
  });

  if (attempts.error instanceof ApiError && attempts.error.status === 404)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        이 노드는 실행되지 않았습니다.
      </p>
    );
  if (attempts.error)
    return (
      <p className="p-4 text-sm text-danger-text">
        <span aria-hidden>! </span>
        {attempts.error.message}
      </p>
    );
  if (!attempts.data)
    return <p className="p-4 text-sm text-muted-foreground">불러오는 중…</p>;

  const list = attempts.data;
  // 기본은 마지막 시도
  const attempt =
    list.find((a) => a.attempt === attemptNo) ?? list[list.length - 1]!;
  const value = tab === 'input' ? attempt.input : attempt.output;
  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3 pb-4">
      {list.length > 1 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {list.map((a) => (
            <button
              key={a.attempt}
              type="button"
              aria-pressed={a === attempt}
              className={cn(
                'rounded-sm px-2 py-1',
                a === attempt
                  ? 'bg-raised-hover text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setAttemptNo(a.attempt)}
            >
              {a.attempt}번째 시도 · {NODE_RUN_LABEL[a.status]}
            </button>
          ))}
        </div>
      )}
      {attempt.error && (
        <p className="text-sm text-danger-text">
          <span aria-hidden>! </span>
          {attempt.error.message}
        </p>
      )}
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label={`${node.title} 입출력`}
          className="flex rounded-md border border-border bg-bg p-0.5"
        >
          {(['input', 'output'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={cn(TAB, tab === t && TAB_ON)}
              onClick={() => {
                setTab(t);
                setPicked(undefined);
              }}
            >
              {t === 'input' ? '입력' : '출력'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto flex h-7 items-center rounded-md px-2.5 text-xs text-label hover:bg-raised-hover"
          onClick={() => void copy()}
        >
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border-subtle bg-bg p-3">
        {value === null || value === undefined ? (
          <p className="text-xs text-muted-foreground">값이 없습니다</p>
        ) : (
          <JsonView
            value={value}
            selected={picked?.path}
            onSelect={(path, v) => setPicked({ path, value: v })}
          />
        )}
      </div>
      {/* 고른 값을 다른 노드의 식에서 읽는 방법(M6 작은 결정 ⑤). 출력일 때만 의미가 있다. */}
      {tab === 'output' && (
        <p className="truncate font-mono text-caption text-muted-foreground">
          {toExpression(node.key, picked?.path ?? [])}
          {picked && ` = ${JSON.stringify(picked.value)}`}
        </p>
      )}
    </div>
  );
}
