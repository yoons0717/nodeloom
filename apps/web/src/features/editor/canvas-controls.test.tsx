// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { addNode, createInitialGraph, newNode } from './commands';
import { UndoRedo } from './canvas-controls';
import { EditorStoreProvider, useEditorStore } from './store-context';

afterEach(cleanup);

function AddNode() {
  const graph = useEditorStore((s) => s.graph);
  const execute = useEditorStore((s) => s.execute);
  return (
    <button
      onClick={() => execute(addNode(newNode(graph, 'http', { x: 0, y: 0 })))}
    >
      노드 추가
    </button>
  );
}

describe('UndoRedo', () => {
  it('되돌릴 동작의 이름을 보여 주고, 되돌리면 다시 하기로 옮겨 간다', () => {
    render(
      <EditorStoreProvider initial={createInitialGraph()}>
        <TooltipProvider>
          <UndoRedo />
          <AddNode />
        </TooltipProvider>
      </EditorStoreProvider>,
    );
    const undo = () => screen.getByRole('button', { name: /^되돌리기/ });
    const redo = () => screen.getByRole('button', { name: /^다시 하기/ });
    expect(undo().getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByText('노드 추가'));
    expect(undo().getAttribute('aria-label')).toBe('되돌리기: 노드 추가');

    fireEvent.click(undo());
    expect(undo().getAttribute('aria-disabled')).toBe('true');
    expect(redo().getAttribute('aria-label')).toBe('다시 하기: 노드 추가');
  });
});
