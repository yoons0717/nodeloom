// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
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

function renderPanel(response: Response) {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NodeRunPanel runId="r1" node={node} status="SUCCESS" />
    </QueryClientProvider>,
  );
  return fetchMock;
}

describe('NodeRunPanel', () => {
  it('고른 노드의 입출력을 시도별로 받아 보여 준다', async () => {
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
    expect(await screen.findByText('2번째 시도 · 성공')).toBeTruthy();
    expect(screen.getByText('1번째 시도 · 실패')).toBeTruthy();
    expect(screen.getByText('응답 코드 503')).toBeTruthy();
    expect(screen.getByText(/"rain": true/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/runs/r1/nodes/${node.id}`,
      expect.anything(),
    );
  });

  it('실행 기록이 없는 노드는 실행되지 않았다고 알린다', async () => {
    renderPanel(Response.json({ message: '없음' }, { status: 404 }));
    expect(
      await screen.findByText('이 노드는 실행되지 않았습니다.'),
    ).toBeTruthy();
  });
});
