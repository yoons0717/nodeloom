'use client';

import { Panel, useReactFlow, useViewport } from '@xyflow/react';

const BUTTON =
  'flex h-full w-9 items-center justify-center text-base hover:bg-raised-hover';

// 캔버스 왼쪽 아래 확대·축소 도구(데모 기준). 배율만 구독하므로 움직일 때 이 부품만 다시 그린다.
export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel
      position="bottom-left"
      className="flex h-9 items-center overflow-hidden rounded-md border border-border bg-surface"
    >
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
