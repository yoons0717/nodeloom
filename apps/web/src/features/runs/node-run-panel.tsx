'use client';

import type { GraphNode } from '@nodeloom/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { InlineError } from '@/components/ui/inline-error';
import { ApiError, clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { NODE_RUN_LABEL } from './format';
import { type JsonPath, JsonView, toExpression } from './json-view';
import { type NodeRunStatus, nodeAttemptsSchema } from './schemas';

// 좁은 화면(터치)에서는 누르기 쉽게 44px, 넓은 화면에서는 28px(M6 6-f).
const TAB =
  'flex h-11 items-center gap-1 rounded-sm px-3 text-body-sm text-muted-foreground md:h-7';
const SEGMENT = 'flex w-fit rounded-md border border-border bg-bg p-0.5';
const SMALL_BUTTON =
  'flex h-11 shrink-0 items-center rounded-md px-2.5 text-xs text-label hover:bg-raised-hover md:h-7';
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
  const [copied, setCopied] = useState<'json' | 'expr' | null>(null);
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
    return <InlineError className="p-4" message={attempts.error.message} />;
  if (!attempts.data)
    return <p className="p-4 text-sm text-muted-foreground">불러오는 중…</p>;

  const list = attempts.data;
  // 기본은 마지막 시도
  const attempt =
    list.find((a) => a.attempt === attemptNo) ?? list[list.length - 1]!;
  const value = tab === 'input' ? attempt.input : attempt.output;
  const expression = toExpression(node.key, picked?.path ?? []);
  const copy = async (what: 'json' | 'expr') => {
    await navigator.clipboard.writeText(
      what === 'json' ? JSON.stringify(value, null, 2) : expression,
    );
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pt-3 pb-4">
      {list.length > 1 && (
        // 입력/출력 탭과 같은 모양의 세그먼트. 실패한 시도에는 ! 글리프(M6 6-f).
        <div role="group" aria-label="시도" className={SEGMENT}>
          {list.map((a) => (
            <button
              key={a.attempt}
              type="button"
              aria-pressed={a === attempt}
              aria-label={`${a.attempt}번째 시도 · ${NODE_RUN_LABEL[a.status]}`}
              className={cn(TAB, a === attempt && TAB_ON)}
              onClick={() => setAttemptNo(a.attempt)}
            >
              {a.status === 'FAILED' && (
                <span aria-hidden className="text-danger-text">
                  !
                </span>
              )}
              {a.attempt}번째 시도
            </button>
          ))}
        </div>
      )}
      {attempt.error && <InlineError message={attempt.error.message} />}
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label={`${node.title} 입출력`}
          className={SEGMENT}
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
          // 글자 끝을 아래 JSON 상자의 오른쪽 끝에 맞춘다.
          className={cn(SMALL_BUTTON, '-mr-2.5 ml-auto')}
          onClick={() => void copy('json')}
        >
          {copied === 'json' ? '복사됨' : '복사'}
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
      {/* 길면 줄을 바꿔 끝까지 보여 준다(M6 6-f). */}
      {tab === 'output' && (
        <div className="flex items-start gap-2">
          {/* 버튼 높이(좁은 화면 44, 넓은 화면 28)의 가운데에 첫 줄이 오게 위아래 여백을 준다. */}
          <p className="min-w-0 flex-1 py-3.5 font-mono text-caption break-all text-muted-foreground md:py-1.5">
            {expression}
            {picked && ` = ${JSON.stringify(picked.value)}`}
          </p>
          <button
            type="button"
            className={cn(SMALL_BUTTON, '-mr-2.5')}
            onClick={() => void copy('expr')}
          >
            {copied === 'expr' ? '복사됨' : '식 복사'}
          </button>
        </div>
      )}
    </div>
  );
}
