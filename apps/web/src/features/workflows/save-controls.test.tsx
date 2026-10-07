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
import { SaveControls } from './save-controls';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 캔버스 없이 그래프를 바꾸고 되돌리는 버튼
function Actions() {
  const graph = useEditorStore((s) => s.graph);
  const execute = useEditorStore((s) => s.execute);
  const undo = useEditorStore((s) => s.undo);
  return (
    <>
      <button
        onClick={() => execute(addNode(newNode(graph, 'http', { x: 0, y: 0 })))}
      >
        노드 추가
      </button>
      <button onClick={undo}>되돌리기</button>
    </>
  );
}

function renderControls() {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditorStoreProvider initial={createInitialGraph()}>
        <SaveControls id="wf-1" initialName="아침 비 알림" />
        <Actions />
      </EditorStoreProvider>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const status = () => screen.getByRole('status').textContent;

describe('SaveControls', () => {
  it('그래프를 바꾸면 저장되지 않음으로 표시하고, 저장하면 덮어쓰기 요청 후 저장됨으로 돌아간다', async () => {
    const fetchMock = renderControls();
    expect(status()).toBe('저장됨');

    fireEvent.click(screen.getByText('노드 추가'));
    expect(status()).toBe('저장되지 않음');

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(status()).toBe('저장됨'));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/workflows/wf-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: '아침 비 알림',
    });
  });

  it('되돌려서 저장한 상태와 내용이 같아지면 다시 저장됨으로 본다', () => {
    renderControls();
    fireEvent.click(screen.getByText('노드 추가'));
    fireEvent.click(screen.getByText('되돌리기'));
    expect(status()).toBe('저장됨');
  });

  it('저장 중 로그인이 만료되면 페이지를 떠나지 않고 다른 탭에서 로그인하라고 안내한다', async () => {
    renderControls();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: '로그인이 필요합니다' }), {
            status: 401,
          }),
        ),
      ),
    );
    fireEvent.click(screen.getByText('노드 추가'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(status()).toMatch(/다른 탭에서 로그인/));
  });

  it('이름을 비우면 저장할 수 없고 이유를 보여 준다', () => {
    renderControls();
    fireEvent.change(screen.getByLabelText('워크플로우 이름'), {
      target: { value: '  ' },
    });
    expect(status()).toBe('이름을 입력하세요');
    expect(
      screen.getByRole('button', { name: '저장' }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
