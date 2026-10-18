// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newNode } from '@/features/editor/commands';
import { NodeRunPanel } from './node-run-panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const node = newNode({ schemaVersion: 1, nodes: [], edges: [] }, 'http', {
  x: 0,
  y: 0,
});

function renderPanel(response: Response, runError?: string) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NodeRunPanel
        runId="r1"
        node={node}
        status="SUCCESS"
        runError={runError}
      />
    </QueryClientProvider>,
  );
  return fetchMock;
}

describe('NodeRunPanel', () => {
  it('패널 위의 실행 오류와 같은 문구는 다시 보여 주지 않는다', async () => {
    const failed = (message: string) =>
      Response.json([
        {
          attempt: 1,
          status: 'FAILED',
          port: null,
          input: null,
          output: null,
          error: { message },
        },
      ]);
    renderPanel(failed('응답 코드 404'), '응답 코드 404');
    await screen.findByText('값이 없습니다');
    expect(screen.queryByText('응답 코드 404')).toBeNull();
    cleanup();

    renderPanel(failed('응답 코드 404'), '다른 노드 오류');
    expect(await screen.findByText('응답 코드 404')).toBeTruthy();
  });

  it('마지막 시도의 출력을 먼저 보여 주고, 시도·입력 탭을 바꿔 볼 수 있다', async () => {
    const fetchMock = renderPanel(
      Response.json([
        {
          attempt: 1,
          status: 'FAILED',
          port: null,
          input: { city: 'Seoul' },
          output: null,
          error: { message: '응답 코드 503' },
        },
        {
          attempt: 2,
          status: 'SUCCESS',
          port: null,
          input: { city: 'Seoul' },
          output: { rain: true },
          error: null,
        },
      ]),
    );
    await screen.findByRole('button', { name: '2번째 시도 · 성공' });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/runs/r1/nodes/${node.id}`,
      expect.anything(),
    );
    expect(screen.getByText('"rain"')).toBeTruthy();
    expect(screen.queryByText('응답 코드 503')).toBeNull();

    // 값을 고르면 다른 노드에서 읽는 식을 보여 준다.
    expect(screen.getByText(`$nodes.${node.key}`)).toBeTruthy();
    fireEvent.click(screen.getByText('true'));
    expect(screen.getByText(`$nodes.${node.key}.rain = true`)).toBeTruthy();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    fireEvent.click(screen.getByRole('button', { name: '식 복사' }));
    expect(writeText).toHaveBeenCalledWith(`$nodes.${node.key}.rain`);

    // 실패한 시도에는 ! 글리프
    expect(
      screen.getByRole('button', { name: '1번째 시도 · 실패' }).textContent,
    ).toBe('!1번째 시도');

    fireEvent.click(screen.getByRole('button', { name: '1번째 시도 · 실패' }));
    expect(screen.getByText('응답 코드 503')).toBeTruthy();
    expect(screen.getByText('값이 없습니다')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: '입력' }));
    expect(screen.getByText('"Seoul"')).toBeTruthy();
  });

  it('실행 기록이 없는 노드는 실행되지 않았다고 알린다', async () => {
    renderPanel(Response.json({ message: '없음' }, { status: 404 }));
    expect(
      await screen.findByText('이 노드는 실행되지 않았습니다.'),
    ).toBeTruthy();
  });

  it('404가 아닌 실패는 실행되지 않았다고 하지 않고 사유를 보여 준다', async () => {
    renderPanel(
      Response.json({ message: '서버 오류가 발생했습니다' }, { status: 500 }),
    );
    expect(await screen.findByText('서버 오류가 발생했습니다')).toBeTruthy();
    expect(screen.queryByText('이 노드는 실행되지 않았습니다.')).toBeNull();
  });
});
