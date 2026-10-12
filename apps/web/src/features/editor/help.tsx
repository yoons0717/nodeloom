'use client';

import { Popover } from '@base-ui/react/popover';
import type { NodeType } from '@nodeloom/core';
import { type ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NodeGlyph } from './node-glyph';
import { NODE_META } from './node-meta';

// 세 곳(Transform·Condition 식, HTTP 본문)이 같이 쓰는 규칙 표
const RULES: [use: string, mean: string, example: string][] = [
  ['이름', '바로 앞 노드 출력의 필드', 'servers, level'],
  ['a.b', '안쪽 필드', 'user.name'],
  ['목록[조건]', '조건에 맞는 것만 고르기', 'servers[up=false]'],
  ['$함수()', '내장 함수', '$count(down), $join(names, ", ")'],
  ['&', '글자 잇기', '"안녕 " & name'],
  ['$nodes.키', '앞쪽 다른 노드의 출력', '$nodes.http_1.title'],
  ['$run.startedAt', '이 실행이 시작된 시각', ''],
  ['$secrets.이름', '비밀값(기록에는 가려짐)', ''],
];

const JSONATA_DOCS = 'https://docs.jsonata.org/overview.html';

// 도움말 팝오버(M6 6-i, DESIGN.md). 식을 보면서 입력하도록 바깥을 누르거나 포커스가 나가도 닫지 않고, × 또는 Esc로 닫는다.
// 팝오버는 (?)가 든 패널(data-help-edge) 바깥에 붙고, 화살표는 (?) 높이를 가리킨다.
function HelpPopover({
  label,
  title,
  icon,
  side,
  sideOffset,
  className,
  children,
}: {
  label: string;
  title: string;
  icon?: ReactNode;
  side: 'left' | 'right';
  sideOffset: number;
  className: string;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const anchor = () => {
    const t = trigger.current;
    if (!t) return null;
    const edge = t.closest('[data-help-edge]') ?? t;
    return {
      contextElement: t,
      getBoundingClientRect: () => {
        const r = t.getBoundingClientRect();
        const e = edge.getBoundingClientRect();
        const x = side === 'left' ? e.left : e.right;
        return new DOMRect(x, r.top, 0, r.height);
      },
    };
  };
  return (
    <Popover.Root
      onOpenChange={(open, details) => {
        if (
          !open &&
          (details.reason === 'outside-press' || details.reason === 'focus-out')
        )
          details.cancel();
      }}
    >
      <Popover.Trigger
        ref={trigger}
        aria-label={`${label} 도움말`}
        className="group -my-1 flex size-6 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-accent-ring"
      >
        <span
          aria-hidden
          className="flex size-4 items-center justify-center rounded-full border border-border-control text-caption leading-none font-bold text-muted-foreground group-hover:border-accent group-hover:bg-accent group-hover:text-bg group-data-popup-open:border-accent group-data-popup-open:bg-accent group-data-popup-open:text-bg"
        >
          ?
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          className="z-50"
        >
          <Popover.Popup
            className={cn(
              'relative flex max-h-(--available-height) flex-col rounded-[10px] border border-help-border bg-help text-foreground shadow-help outline-none',
              className,
            )}
          >
            <Popover.Arrow className="size-2.5 rotate-45 border-help-border bg-help data-[side=left]:-right-1.5 data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:-left-1.5 data-[side=right]:border-b data-[side=right]:border-l" />
            <div className="flex shrink-0 items-center gap-2 pt-3 pr-3 pl-4">
              {icon}
              <Popover.Title className="min-w-0 flex-1 truncate text-sm font-bold">
                {title}
              </Popover.Title>
              <Popover.Close
                aria-label="닫기"
                className="flex size-7 items-center justify-center rounded-md text-base text-muted-foreground outline-none hover:bg-raised-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-accent-ring"
              >
                ×
              </Popover.Close>
            </div>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// 식 칸의 도움말. children은 노드마다 다른 설명이고, 아래 규칙 표와 안내는 같다.
export function ExpressionHelp({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <HelpPopover
      label={label}
      title={title}
      side="left"
      sideOffset={12}
      className="max-h-[min(640px,var(--available-height))] w-[440px]"
    >
      <div className="flex shrink-0 flex-col gap-2.5 px-4 pt-2 pb-3.5 text-body-sm text-label">
        {children}
      </div>
      <div className="shrink-0 border-t border-border px-4 pt-2.5 pb-1 text-caption font-medium text-muted-foreground">
        식에서 쓸 수 있는 것
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        {RULES.map(([use, mean, example]) => (
          <div
            key={use}
            className="grid grid-cols-[116px_minmax(0,1fr)_minmax(0,1.15fr)] items-baseline gap-2.5 rounded-sm px-2 py-[5px] text-xs leading-[18px] odd:bg-help-stripe"
          >
            <span className="font-mono text-accent">{use}</span>
            <span className="text-label">{mean}</span>
            <span className="font-mono text-caption leading-[18px] text-muted-foreground">
              {example}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-2.5 text-xs leading-[18px] text-muted-foreground">
        <span className="flex-1">
          앞 노드 출력이 어떻게 생겼는지는 한 번 실행한 뒤 실행 상세에서 노드를
          누르면 보여요.
        </span>
        <a
          href={JSONATA_DOCS}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 font-medium text-accent hover:text-accent-hover"
        >
          JSONata 문서 ↗
        </a>
      </div>
    </HelpPopover>
  );
}

// 식 도움말 안의 예시 칸. note는 예시 아래 흐린 설명.
export function HelpCode({
  children,
  note,
}: {
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-bg px-2.5 py-1.5 font-mono text-xs leading-[18px] text-foreground">
      <code>{children}</code>
      {note && <span className="font-sans text-muted-foreground">{note}</span>}
    </div>
  );
}

// 노드 목록 항목의 도움말
export function NodeHelp({ type }: { type: NodeType }) {
  const meta = NODE_META[type];
  return (
    <HelpPopover
      label={meta.label}
      title={meta.label}
      icon={<NodeGlyph type={type} size="xs" />}
      side="right"
      sideOffset={8}
      className="w-[340px]"
    >
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 px-4 pt-2.5 pb-3.5 text-body-sm">
        <dt className="text-xs leading-5 text-muted-foreground">하는 일</dt>
        <dd>{meta.does}</dd>
        <dt className="text-xs leading-5 text-muted-foreground">
          다음 노드가
          <br />
          받는 값
        </dt>
        <dd>{meta.passes}</dd>
      </dl>
      <p className="border-t border-border px-4 pt-2.5 pb-3 text-xs leading-[18px] text-muted-foreground">
        노드 하나에 선이 여러 개 들어오면, 성공한 쪽들의 출력이{' '}
        <code className="font-mono whitespace-nowrap text-foreground">
          {'{ 키: 출력 }'}
        </code>
        으로 묶여서 들어와요.
      </p>
    </HelpPopover>
  );
}
