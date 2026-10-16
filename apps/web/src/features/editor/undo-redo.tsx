'use client';

import { Redo2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CONTROL_BUTTON } from './canvas-controls';
import { useEditorStore } from './store-context';

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
            className={`${CONTROL_BUTTON} aria-disabled:cursor-default aria-disabled:text-disabled aria-disabled:hover:bg-transparent`}
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
