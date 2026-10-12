// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialGraph, newNode } from './commands';
import { SettingsPanel } from './settings-panel';
import { EditorStoreProvider, useEditorStore } from './store-context';

afterEach(cleanup);

// 캔버스 없이 노드 하나를 고른 상태로 만든다.
function Select({ nodeId }: { nodeId: string }) {
  const setSelection = useEditorStore((s) => s.setSelection);
  useEffect(
    () => setSelection({ nodeIds: [nodeId], edgeIds: [] }),
    [setSelection, nodeId],
  );
  return null;
}

function renderHttpNode() {
  const graph = createInitialGraph();
  const http = newNode(graph, 'http', { x: 0, y: 0 });
  render(
    <EditorStoreProvider initial={{ ...graph, nodes: [...graph.nodes, http] }}>
      <Select nodeId={http.id} />
      <SettingsPanel />
    </EditorStoreProvider>,
  );
}

describe('SettingsPanel', () => {
  it('잘못된 값을 넣으면 해당 칸 아래에 오류를 보여 주고, 고치면 지운다', () => {
    renderHttpNode();
    const url = screen.getByLabelText('URL');
    expect(url.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('URL을 입력하세요')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('본문'), {
      target: { value: '{ "a": 1' },
    });
    expect(screen.getByText(/^식 문법 오류: "}"가 빠졌습니다/)).toBeTruthy();

    fireEvent.change(url, { target: { value: 'https://example.com' } });
    expect(screen.queryByText('URL을 입력하세요')).toBeNull();
    expect(url.getAttribute('aria-invalid')).toBeNull();
  });
});
