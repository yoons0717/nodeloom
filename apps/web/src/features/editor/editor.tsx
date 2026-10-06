'use client';

import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Canvas } from './canvas';
import { getGraphIssues } from './graph-issues';
import { Palette } from './palette';
import { EditorStoreProvider, useEditorStore } from './store-context';
import { useEditorShortcuts } from './use-editor-shortcuts';

export function Editor() {
  return (
    <EditorStoreProvider>
      <ReactFlowProvider>
        <EditorLayout />
      </ReactFlowProvider>
    </EditorStoreProvider>
  );
}

function EditorLayout() {
  useEditorShortcuts();
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <Canvas />
        {/* 설정 패널은 2-c에서 추가 */}
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

  const button =
    'rounded-md border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-700';
  return (
    <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <h1 className="font-semibold">새 워크플로우</h1>
      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          onClick={undo}
          disabled={!canUndo}
        >
          되돌리기
        </button>
        <button
          type="button"
          className={button}
          onClick={redo}
          disabled={!canRedo}
        >
          다시 실행
        </button>
      </div>
      {graphIssues.map((i) => (
        <span key={i.code} role="status" className="text-sm text-red-600">
          {i.message}
        </span>
      ))}
    </header>
  );
}
