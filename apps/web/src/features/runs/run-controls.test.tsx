// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addNode,
  createInitialGraph,
  newNode,
} from '@/features/editor/commands';
import {
  EditorStoreProvider,
  useEditorStore,
} from '@/features/editor/store-context';
import { SaveControls } from '@/features/workflows/save-controls';
import { RunControls } from './run-controls';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('RunControls', () => {
  it('저장되지 않은 변경이 있으면 저장한 뒤 실행하고, 실행 결과를 보여 준다', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'PUT')
        return Promise.resolve(new Response(null, { status: 204 }));
      if (init?.method === 'POST') return json({ runId: 'r1' }, 202);
      return json({
        status: 'FAILED',
        error: { message: '응답 코드 404' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EditorStoreProvider initial={createInitialGraph()}>
          <SaveControls
            id="wf-1"
            initialName="w"
            after={(ensureSaved) => (
              <RunControls workflowId="wf-1" ensureSaved={ensureSaved} />
            )}
          />
          <AddNode />
        </EditorStoreProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText('노드 추가'));
    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    await screen.findByText('실행 실패: 응답 코드 404');
    expect(
      fetchMock.mock.calls.map(
        ([url, init]) => `${init?.method ?? 'GET'} ${url}`,
      ),
    ).toEqual([
      'PUT /api/workflows/wf-1',
      'POST /api/workflows/wf-1/runs',
      'GET /api/runs/r1/status',
    ]);
    await waitFor(() => expect(screen.getByText('저장됨')).toBeTruthy());
    expect(
      screen.getByRole('link', { name: '결과 보기' }).getAttribute('href'),
    ).toBe('/w/wf-1/runs/r1');
  });
  it('성공 토스트는 잠시 뒤 저절로 닫히고, 실패 토스트는 닫기 전까지 남는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const respond = (status: string) =>
      vi.fn((_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? json({ runId: 'r1' }, 202)
          : json({
              status,
              error: status === 'FAILED' ? { message: '응답 코드 500' } : null,
            }),
      );
    const renderRun = () =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <EditorStoreProvider initial={createInitialGraph()}>
            <RunControls
              workflowId="wf-1"
              ensureSaved={() => Promise.resolve(true)}
            />
          </EditorStoreProvider>
        </QueryClientProvider>,
      );

    vi.stubGlobal('fetch', respond('SUCCESS'));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: '실행' }));
    await screen.findByText('실행 성공');
    await vi.advanceTimersByTimeAsync(4000);
    await waitFor(() => expect(screen.queryByText('실행 성공')).toBeNull());
    cleanup();

    vi.stubGlobal('fetch', respond('FAILED'));
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: '실행' }));
    await screen.findByText('실행 실패: 응답 코드 500');
    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByText('실행 실패: 응답 코드 500')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText('실행 실패: 응답 코드 500')).toBeNull();
    vi.useRealTimers();
  });
});
