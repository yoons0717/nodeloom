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
});
