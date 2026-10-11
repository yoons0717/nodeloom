'use client';

import type { Graph } from '@nodeloom/core';
import { ReactFlowProvider } from '@xyflow/react';
import { Profiler, type ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
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
// toolbar: 상단 바 왼쪽에 들어갈 것(저장 버튼 등). 스토어 안에서 그려지므로 스토어를 읽을 수 있다.
export function Editor({
  initial,
  bench = false,
  toolbar,
}: {
  initial?: Graph;
  bench?: boolean;
  toolbar?: ReactNode;
}) {
  const editor = (
    <EditorStoreProvider initial={initial}>
      <ReactFlowProvider>
        <TooltipProvider>
          <EditorLayout bench={bench} toolbar={toolbar} />
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

function EditorLayout({
  bench,
  toolbar,
}: {
  bench: boolean;
  toolbar?: ReactNode;
}) {
  useEditorShortcuts();
  return (
    <div className="flex h-dvh flex-col">
      <TopBar toolbar={toolbar} />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <Canvas>{bench && <PerfHud />}</Canvas>
        <SettingsPanel />
      </div>
    </div>
  );
}

// 상단 바: 높이 56, 한 줄(데모). toolbar가 없으면(벤치) 제목과 편집 도구만 둔다.
function TopBar({ toolbar }: { toolbar?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-4">
      {toolbar ?? (
        <>
          <h1 className="text-base font-bold">새 워크플로우</h1>
          <TopBarDivider />
          <UndoRedo />
          <div className="ml-auto">
            <GraphIssueBadge />
          </div>
        </>
      )}
    </header>
  );
}

export function TopBarDivider() {
  return <span aria-hidden className="h-5 w-px shrink-0 bg-border" />;
}

export function UndoRedo() {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  return (
    <div className="flex gap-1">
      <Button variant="ghost" onClick={undo} disabled={!canUndo}>
        되돌리기
        <kbd className="font-mono text-caption text-muted-foreground">⌘Z</kbd>
      </Button>
      <Button variant="ghost" onClick={redo} disabled={!canRedo}>
        다시 하기
      </Button>
    </div>
  );
}

// 특정 노드에 붙지 않는 문제(예: Trigger 개수)의 개수. 마우스를 올리면 문구를 보여 준다.
export function GraphIssueBadge() {
  // 셀렉터가 매번 새 배열을 돌려주면 Zustand가 계속 바뀐 것으로 보고 무한히 다시 그린다. 그래프만 구독하고 계산은 밖에서 한다.
  const graph = useEditorStore((s) => s.graph);
  const issues = getGraphIssues(graph).graphLevel;
  if (issues.length === 0) return null;
  return (
    <Badge
      tone="danger"
      title={issues.map((i) => i.message).join('\n')}
      aria-label={`문제 ${issues.length}개: ${issues.map((i) => i.message).join(', ')}`}
    >
      문제 {issues.length}
    </Badge>
  );
}
