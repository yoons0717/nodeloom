'use client';

import { Panel, useReactFlow, useViewport } from '@xyflow/react';
import type { ReactNode } from 'react';

export const CONTROL_BUTTON =
  'flex h-full w-9 items-center justify-center text-base hover:bg-raised-hover pointer-coarse:w-11';

// 캔버스 왼쪽 아래 확대·축소 도구(데모 기준). 배율만 구독하므로 움직일 때 이 부품만 다시 그린다.
// leading: 확대·축소 앞에 둘 도구(에디터의 되돌리기·다시 하기, M6 6-h).
// 실행 상세도 이 도구를 쓰므로, 에디터 스토어를 쓰는 되돌리기 버튼은 undo-redo.tsx에 따로 둔다(M9).
export function CanvasControls({ leading }: { leading?: ReactNode }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel
      position="bottom-left"
      className="flex h-9 items-center overflow-hidden rounded-md border border-border bg-surface pointer-coarse:h-11 pointer-coarse:rounded-lg"
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
        className={CONTROL_BUTTON}
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
        className={CONTROL_BUTTON}
        onClick={() => void zoomIn()}
      >
        +
      </button>
      <span aria-hidden className="h-5 w-px bg-border" />
      <button
        type="button"
        aria-label="맞춤 보기"
        title="맞춤 보기"
        className={`${CONTROL_BUTTON} text-body-sm`}
        onClick={() => void fitView({ maxZoom: 1 })}
      >
        ⤢
      </button>
    </Panel>
  );
}
