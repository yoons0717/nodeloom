'use client';

import { type ReactElement, type ReactNode, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

// 마우스를 올리거나 포커스하면 열리고, 누르면(터치) 열고 닫는 툴팁(RESPONSIVE R3).
// title=만으로는 터치와 키보드에서 볼 수 없다. children은 포커스를 받을 수 있어야 한다.
export function InfoTip({
  content,
  children,
}: {
  content: ReactNode;
  children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next, details) => {
        // 누르는 것은 아래 onClick이 맡는다.
        if (details.reason !== 'trigger-press') setOpen(next);
      }}
    >
      <TooltipTrigger render={children} onClick={() => setOpen((o) => !o)} />
      <TooltipContent className="max-w-xs whitespace-pre-line">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
