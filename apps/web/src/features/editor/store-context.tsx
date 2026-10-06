'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { useStore } from 'zustand';
import { createEditorStore, type EditorState, type EditorStore } from './store';

const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({ children }: { children: ReactNode }) {
  // 에디터가 처음 그려질 때 한 번만 만든다(DECISIONS B-12).
  const [store] = useState(() => createEditorStore());
  return (
    <EditorStoreContext.Provider value={store}>
      {children}
    </EditorStoreContext.Provider>
  );
}

export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store)
    throw new Error(
      'useEditorStore는 EditorStoreProvider 안에서만 쓸 수 있습니다',
    );
  return useStore(store, selector);
}
