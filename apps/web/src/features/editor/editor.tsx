'use client';

import type { Graph } from '@nodeloom/core';
import { ReactFlowProvider } from '@xyflow/react';
import { Profiler } from 'react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { onEditorRender } from './bench';
import { Canvas } from './canvas';
import { getGraphIssues } from './graph-issues';
import { Palette } from './palette';
import { PerfHud } from './perf-hud';
import { SettingsPanel } from './settings-panel';
import { EditorStoreProvider, useEditorStore } from './store-context';
import { useEditorShortcuts } from './use-editor-shortcuts';

// bench: 성능 HUD를 보이고 측정값을 모은다(/bench 전용).
export function Editor({
  initial,
  bench = false,
}: {
  initial?: Graph;
  bench?: boolean;
}) {
  const editor = (
    <EditorStoreProvider initial={initial}>
      <ReactFlowProvider>
        <TooltipProvider>
          <EditorLayout bench={bench} />
        </TooltipProvider>
      </ReactFlowProvider>
    </EditorStoreProvider>
  );
  return bench ? (
    <Profiler id="editor" onRender={onEditorRender}>
      {editor}
    </Profiler>
  ) : (
    editor
  );
}

function EditorLayout({ bench }: { bench: boolean }) {
  useEditorShortcuts();
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <Canvas>{bench && <PerfHud />}</Canvas>
        <SettingsPanel />
      </div>
    </div>
  );
}

function TopBar() {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  // 특정 노드에 붙지 않는 문제(예: Trigger 개수)는 상단에 보여 준다.
  const graph = useEditorStore((s) => s.graph);
  // 셀렉터가 매번 새 배열을 돌려주면 Zustand가 계속 바뀐 것으로 보고 무한히 다시 그린다. 그래프만 구독하고 계산은 밖에서 한다.
  const graphIssues = getGraphIssues(graph).graphLevel;

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-divider bg-surface px-5 py-2.5">
      <h1 className="text-base font-bold">새 워크플로우</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={undo} disabled={!canUndo}>
          되돌리기
        </Button>
        <Button variant="outline" onClick={redo} disabled={!canRedo}>
          다시 실행
        </Button>
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        {graphIssues.map((i) => (
          <span
            key={i.code}
            role="status"
            className="rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-bold text-destructive-text"
          >
            {i.message}
          </span>
        ))}
      </div>
    </header>
  );
}
