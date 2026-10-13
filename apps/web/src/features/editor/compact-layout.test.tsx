// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGraph } from './commands';
import { Palette } from './palette';
import { SettingsPanel } from './settings-panel';
import { EditorStoreProvider, useEditorStore } from './store-context';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 그래프의 노드 수와 선택을 글자로 보여 준다.
function Probe() {
  const graph = useEditorStore((s) => s.graph);
  const selection = useEditorStore((s) => s.selection);
  const last = graph.nodes.at(-1)!;
  return (
    <p data-testid="probe">
      {graph.nodes.length}:{last.type}:
      {selection.nodeIds[0] === last.id ? '선택' : '선택 없음'}
    </p>
  );
}

function SelectFirst() {
  const graph = useEditorStore((s) => s.graph);
  const setSelection = useEditorStore((s) => s.setSelection);
  const id = graph.nodes[0]!.id;
  useEffect(
    () => setSelection({ nodeIds: [id], edgeIds: [] }),
    [setSelection, id],
  );
  return null;
}

function renderInEditor(children: ReactNode) {
  // md – lg(xl 미만), 터치
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
  // Trigger 설정이 역할(관리자·데모)을 묻는다.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ role: 'admin' }))),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditorStoreProvider initial={createInitialGraph()}>
        <ReactFlowProvider>
          {children}
          <Probe />
        </ReactFlowProvider>
      </EditorStoreProvider>
    </QueryClientProvider>,
  );
}

const probe = () => screen.getByTestId('probe').textContent;

describe('간단 배치(md – lg)', () => {
  it('팔레트 레일의 "캔버스에 추가"는 노드를 추가하고 그 노드를 고른다', () => {
    renderInEditor(<Palette />);
    expect(probe()).toBe('1:trigger:선택 없음');
    fireEvent.click(screen.getByRole('button', { name: 'HTTP' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'HTTP' })).getByRole('button', {
        name: /캔버스에 추가/,
      }),
    );
    expect(probe()).toBe('2:http:선택');
  });

  it('겹친 설정 패널은 Esc와 닫기 버튼으로 닫힌다(선택 해제)', () => {
    renderInEditor(
      <>
        <SelectFirst />
        <SettingsPanel />
      </>,
    );
    expect(screen.getByRole('heading', { name: '시작' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: '시작' })).toBeNull();
  });

  it('겹친 설정 패널의 닫기 버튼도 선택을 푼다', () => {
    renderInEditor(
      <>
        <SelectFirst />
        <SettingsPanel />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: '설정 닫기' }));
    expect(screen.queryByRole('heading', { name: '시작' })).toBeNull();
  });
});
