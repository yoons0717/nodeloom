'use client';

import { Panel, useReactFlow, useViewport } from '@xyflow/react';
import { Redo2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEditorStore } from './store-context';

const BUTTON =
  'flex h-full w-9 items-center justify-center text-base hover:bg-raised-hover';

// 캔버스 왼쪽 아래 확대·축소 도구(데모 기준). 배율만 구독하므로 움직일 때 이 부품만 다시 그린다.
// leading: 확대·축소 앞에 둘 도구(에디터의 되돌리기·다시 하기, M6 6-h).
export function CanvasControls({ leading }: { leading?: ReactNode }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel
      position="bottom-left"
      className="flex h-9 items-center overflow-hidden rounded-md border border-border bg-surface"
    >
      {leading && (
        <>
          {leading}
          <span aria-hidden className="h-5 w-px bg-border" />
        </>
      )}
      <button
        type="button"
        aria-label="축소"
        className={BUTTON}
        onClick={() => void zoomOut()}
      >
        −
      </button>
      <span className="w-12 text-center font-mono text-xs text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="확대"
        className={BUTTON}
        onClick={() => void zoomIn()}
      >
        +
      </button>
      <span aria-hidden className="h-5 w-px bg-border" />
      <button
        type="button"
        aria-label="맞춤 보기"
        title="맞춤 보기"
        className={`${BUTTON} text-body-sm`}
        onClick={() => void fitView({ maxZoom: 1 })}
      >
        ⤢
      </button>
    </Panel>
  );
}

// 되돌리기·다시 하기 아이콘. 툴팁에 무엇이 되돌려지는지와 단축키를 보여 준다(M6 6-h, 시안 2a).
export function UndoRedo() {
  const undoLabel = useEditorStore((s) => s.past.at(-1)?.command.label);
  const redoLabel = useEditorStore((s) => s.future[0]?.command.label);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  return (
    <>
      <HistoryButton
        name="되돌리기"
        detail={undoLabel}
        keys="⌘Z"
        onClick={undo}
      >
        <Undo2 className="size-4" />
      </HistoryButton>
      <HistoryButton
        name="다시 하기"
        detail={redoLabel}
        keys="⇧⌘Z"
        onClick={redo}
      >
        <Redo2 className="size-4" />
      </HistoryButton>
    </>
  );
}

function HistoryButton({
  name,
  detail,
  keys,
  onClick,
  children,
}: {
  name: string;
  detail: string | undefined;
  keys: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const label = detail ? `${name}: ${detail}` : name;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            // 할 것이 없으면 누를 수 없지만, 툴팁은 보이도록 포커스는 남긴다.
            aria-disabled={!detail}
            className={`${BUTTON} aria-disabled:cursor-default aria-disabled:text-disabled aria-disabled:hover:bg-transparent`}
            onClick={() => detail && onClick()}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <kbd className="font-mono text-caption text-muted-foreground">
          {keys}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
