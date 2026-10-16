'use client';

import { Popover } from '@base-ui/react/popover';
import { NODE_SPECS, type NodeType } from '@nodeloom/core';
import { useReactFlow, useStoreApi } from '@xyflow/react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isAtLeast, usePointerFine } from '@/lib/media';
import { cn } from '@/lib/utils';
import { GRID } from './canvas';
import { addNode, newNode } from './commands';
import { HELP_ARROW, HELP_POPUP, NodeHelp } from './help';
import { NodeGlyph } from './node-glyph';
import { DRAG_MIME, NODE_META } from './node-meta';
import { useEditorStore } from './store-context';

const TYPES = Object.keys(NODE_SPECS) as NodeType[];
// 노드 카드 크기(DESIGN.md). 카드 가운데가 캔버스 가운데에 오게 놓는다.
const CARD = { width: 136, height: 84 };
// md – lg에서 노드를 고르면 캔버스 오른쪽 위에 겹쳐 열리는 설정 패널 폭(w-80)
const OVERLAY_PANEL = 320;

// 지금 보이는 캔버스 가운데에 노드를 놓고 고른다(DESIGN.md 반응형). 끌어다 놓기를 못 쓰는 터치 기기에서도 넣을 수 있게.
// md – lg에서는 추가하자마자 설정 패널이 겹쳐 열리므로 그 폭을 뺀 영역의 가운데에 놓는다.
function useAddAtCenter() {
  const graph = useEditorStore((s) => s.graph);
  const execute = useEditorStore((s) => s.execute);
  const setSelection = useEditorStore((s) => s.setSelection);
  const { screenToFlowPosition } = useReactFlow();
  const flow = useStoreApi();
  return (type: NodeType) => {
    const rect = flow.getState().domNode?.getBoundingClientRect();
    const center = rect
      ? screenToFlowPosition({
          x:
            rect.left +
            (rect.width - (isAtLeast('xl') ? 0 : OVERLAY_PANEL)) / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 0, y: 0 };
    const snap = (v: number) => Math.round(v / GRID[0]) * GRID[0];
    const node = newNode(graph, type, {
      x: snap(center.x - CARD.width / 2),
      y: snap(center.y - CARD.height / 2),
    });
    execute(addNode(node));
    setSelection({ nodeIds: [node.id], edgeIds: [] });
  };
}

// 노드 목록. xl 이상은 펼친 목록(224), md – lg는 글리프만 있는 56px 레일(DESIGN.md 반응형).
// 둘 다 그리고 CSS로 하나만 보인다. 끌어다 놓기는 마우스에서만, 누르면 캔버스 가운데에 추가한다.
export function Palette() {
  const add = useAddAtCenter();
  const fine = usePointerFine();
  const drag = (type: NodeType) =>
    fine
      ? {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData(DRAG_MIME, type);
            e.dataTransfer.effectAllowed = 'move';
          },
        }
      : {};
  return (
    <>
      <aside
        aria-label="노드 목록"
        data-help-edge
        className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-surface pt-3 xl:hidden"
      >
        {TYPES.map((type) => (
          <RailItem
            key={type}
            type={type}
            onAdd={() => add(type)}
            drag={drag(type)}
          />
        ))}
      </aside>
      <FullPalette add={add} drag={drag} />
    </>
  );
}

// 레일 칸(44px)을 누르면 이름 · 하는 일 · (?) · "캔버스에 추가"가 있는 팝오버가 열린다.
function RailItem({
  type,
  onAdd,
  drag,
}: {
  type: NodeType;
  onAdd: () => void;
  drag: object;
}) {
  const meta = NODE_META[type];
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={meta.label}
        {...drag}
        className="flex size-11 items-center justify-center rounded-lg outline-none hover:bg-raised-hover focus-visible:ring-3 focus-visible:ring-accent-ring data-popup-open:bg-raised-hover"
      >
        <NodeGlyph type={type} size="md" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="right"
          sideOffset={8}
          align="start"
          collisionPadding={8}
          className="z-50"
        >
          <Popover.Popup className={cn(HELP_POPUP, 'w-62 gap-2.5 p-3')}>
            <Popover.Arrow className={HELP_ARROW} />
            <div className="flex items-center gap-2">
              <NodeGlyph type={type} size="xs" />
              <Popover.Title className="text-sm font-bold">
                {meta.label}
              </Popover.Title>
              <span className="ml-auto">
                <NodeHelp type={type} />
              </span>
            </div>
            <p className="text-body-sm text-label">{meta.does}</p>
            <Popover.Close
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              onClick={onAdd}
            >
              + 캔버스에 추가
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FullPalette({
  add,
  drag,
}: {
  add: (type: NodeType) => void;
  drag: (type: NodeType) => object;
}) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const visible = TYPES.filter(
    (t) =>
      !q ||
      `${t} ${NODE_META[t].label} ${NODE_META[t].description} ${NODE_META[t].keywords}`
        .toLowerCase()
        .includes(q),
  );

  // "/"를 누르면 검색 칸으로. 입력 중일 때는 그대로 글자를 친다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || t.closest('input, textarea, [contenteditable]'))
        return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside
      aria-label="노드 목록"
      data-help-edge
      className="hidden w-56 shrink-0 flex-col gap-3 border-r border-border-subtle bg-surface p-4 xl:flex"
    >
      <div className="relative">
        <Input
          ref={search}
          aria-label="노드 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="노드 검색"
          className="pr-9"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border px-1.5 font-mono text-caption text-muted-foreground">
          /
        </kbd>
      </div>
      <ul className="flex flex-col gap-1">
        {visible.map((type) => (
          // (?)는 누르는 영역 밖에 두어 누를 때 추가나 끌기가 시작되지 않게 한다(M6 6-i).
          <li
            key={type}
            className="flex items-start rounded-md p-2 hover:bg-raised has-data-popup-open:bg-raised-open"
          >
            {/* 누르면 캔버스 가운데에 추가한다. 터치 노트북도 노드를 넣을 수 있게(DESIGN.md 반응형). */}
            <button
              type="button"
              aria-label={`${NODE_META[type].label} 캔버스에 추가`}
              {...drag(type)}
              onClick={() => add(type)}
              className="flex min-w-0 flex-1 items-start gap-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-accent-ring pointer-fine:cursor-grab pointer-fine:active:cursor-grabbing"
            >
              <NodeGlyph type={type} size="md" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  {NODE_META[type].label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {NODE_META[type].description}
                </span>
              </span>
            </button>
            <span className="-mt-0.5 -mr-1">
              <NodeHelp type={type} />
            </span>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="p-2 text-xs text-muted-foreground">
            일치하는 노드가 없습니다
          </li>
        )}
      </ul>
      <p className="mt-auto text-xs text-muted-foreground">
        누르거나 캔버스로 끌어다 놓기
      </p>
    </aside>
  );
}
