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
  it('그래프를 바꾸면 저장 안 됨 칩 안에 저장 버튼이 나오고, 저장하면 덮어쓰기 요청 후 저장됨으로 돌아간다', async () => {
    const fetchMock = renderControls();
    expect(status()).toBe('저장됨');

    fireEvent.click(screen.getByText('노드 추가'));
    expect(status()).toBe('저장 안 됨');

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(status()).toBe('저장됨'));
    // 저장할 것이 없으면 저장 버튼은 없다(M6 6-h).
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
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

  it('저장 안 된 변경이 생기고 없어질 때마다 onDirtyChange로 알린다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    const seen: boolean[] = [];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EditorStoreProvider initial={createInitialGraph()}>
          {/* 값을 돌려주는 콜백도 받는다(effect 정리 함수로 쓰이면 안 된다). */}
          <SaveControls
            id="wf-1"
            initialName="아침 비 알림"
            onDirtyChange={(d) => seen.push(d)}
          />
          <Actions />
        </EditorStoreProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('노드 추가'));
    fireEvent.click(screen.getByText('되돌리기'));
    expect(seen).toEqual([false, true, false]);
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
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('이름을 비우면 저장할 수 없고 이유를 보여 준다', () => {
    renderControls();
    fireEvent.change(screen.getByLabelText('워크플로우 이름'), {
      target: { value: '  ' },
    });
    expect(status()).toBe('이름을 입력하세요');
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
  });

  it('저장하지 않은 변경이 있으면 앱 안 링크로 나가기 전에 묻고, 취소하면 머문다', () => {
    renderControls();
    fireEvent.click(screen.getByText('노드 추가'));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const link = document.createElement('a');
    link.href = '/runs';
    link.setAttribute('href', '/runs');
    document.body.appendChild(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(confirm).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    link.remove();
    confirm.mockRestore();
  });
});

// 저장(PUT)이 끝나는 시점을 테스트가 정한다.
function stubSlowSave() {
  const finish: (() => void)[] = [];
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) =>
        finish.push(() => resolve(new Response(null, { status: 204 }))),
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, finish };
}

function renderWithRun(
  after?: (ensureSaved: () => Promise<boolean>) => React.ReactNode,
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditorStoreProvider initial={createInitialGraph()}>
        <SaveControls id="wf-1" initialName="아침 알림" after={after} />
      </EditorStoreProvider>
    </QueryClientProvider>,
  );
  return screen.getByLabelText<HTMLInputElement>('워크플로우 이름');
}

describe('SaveControls 저장 중', () => {
  it('저장 중에 이어서 입력한 이름을 저장이 끝나도 지우지 않는다', async () => {
    const { finish } = stubSlowSave();
    const name = renderWithRun();
    fireEvent.change(name, { target: { value: '아침 비 알림' } });
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    await waitFor(() => expect(finish).toHaveLength(1));
    fireEvent.change(name, { target: { value: '아침 비 알림 2' } });
    finish[0]!();
    await waitFor(() => expect(screen.getByText('저장 안 됨')).toBeTruthy());
    expect(name.value).toBe('아침 비 알림 2');
  });

  it('저장 중에 실행하면 저장을 한 번 더 보내지 않고 끝나기를 기다린다', async () => {
    const { fetchMock, finish } = stubSlowSave();
    let ensure!: () => Promise<boolean>;
    const name = renderWithRun((ensureSaved) => {
      ensure = ensureSaved;
      return null;
    });
    fireEvent.change(name, { target: { value: '아침 비 알림' } });
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    await waitFor(() => expect(finish).toHaveLength(1));
    const saved = ensure();
    finish.forEach((f) => f());
    expect(await saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
