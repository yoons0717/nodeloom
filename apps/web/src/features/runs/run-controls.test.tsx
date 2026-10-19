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
  // 테스트가 중간에 실패해도 가짜 타이머가 다음 테스트로 새지 않게 한다.
  vi.useRealTimers();
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

// 저장은 늘 성공한 것으로 두고 실행 버튼만 그린다.
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

describe('RunControls', () => {
  it('저장되지 않은 변경이 있으면 저장한 뒤 실행하고, 실행 결과를 보여 준다', async () => {
    const fetchMock = vi.fn((_: string, init?: RequestInit) => {
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

    await screen.findByText('실행 실패');
    expect(screen.getByText('응답 코드 404')).toBeTruthy();
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
    await screen.findByText('응답 코드 500');
    await vi.advanceTimersByTimeAsync(4000);
    expect(screen.getByText('실행 실패')).toBeTruthy();
    expect(screen.getByText('응답 코드 500')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText('응답 코드 500')).toBeNull();
  });

  it('실행 요청이 거절되면 실행 실패와 서버 사유를 보여 주고, 다시 누를 수 있다', async () => {
    const fetchMock = vi.fn(() =>
      json({ message: '검사 오류 2개가 있어 실행할 수 없습니다' }, 422),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    expect(
      await screen.findByText('검사 오류 2개가 있어 실행할 수 없습니다'),
    ).toBeTruthy();
    expect(screen.getByText('실행 실패')).toBeTruthy();
    // 실행이 만들어지지 않았으니 결과 링크도, 상태 조회도 없다.
    expect(screen.queryByRole('link', { name: '결과 보기' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: '실행' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('실행이 끝날 때까지 버튼을 막아 두 번 실행하지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let polls = 0;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ runId: 'r1' }, 202)
        : json({ status: polls++ === 0 ? 'RUNNING' : 'SUCCESS', error: null }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderRun();
    fireEvent.click(screen.getByRole('button', { name: '실행' }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('실행 중'),
    );
    const button = screen.getByRole('button', { name: '실행 중' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);

    // 1초 뒤 다시 조회하면 성공으로 끝난다.
    await vi.advanceTimersByTimeAsync(1000);
    await screen.findByText('실행 성공');
    expect(
      screen.getByRole('button', { name: '실행' }).hasAttribute('disabled'),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1);
  });
});
