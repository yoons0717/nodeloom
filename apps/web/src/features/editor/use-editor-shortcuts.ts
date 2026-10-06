'use client';

import { useEffect } from 'react';
import { useEditorStore } from './store-context';

// 입력 칸에 포커스가 있으면 에디터 단축키를 무시하고 브라우저 기본 동작(글자 지우기, 글자 되돌리기)에 맡긴다.
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

// 삭제는 캔버스를 보고 있을 때만. 설정 패널의 버튼·스위치에 포커스가 있을 때 Backspace로 노드가 지워지면 안 된다.
function onCanvas(target: EventTarget | null) {
  return (
    target === document.body ||
    (target instanceof Element && target.closest('.react-flow') !== null)
  );
}

export function useEditorShortcuts() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const deleteSelection = useEditorStore((s) => s.deleteSelection);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        onCanvas(e.target)
      ) {
        e.preventDefault();
        deleteSelection();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, deleteSelection]);
}
