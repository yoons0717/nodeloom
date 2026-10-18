// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FailureWorkflowSelect } from './failure-workflow-select';

const clientApi = vi.hoisted(() =>
  vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>(),
);
vi.mock('@/lib/client-api', () => ({ clientApi }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const wf = (id: string, name: string) => ({
  id,
  name,
  nodeCount: 1,
  cron: null,
  lastRun: null,
  failedLast24h: 0,
  updatedAt: '2026-10-17T00:00:00Z',
});

// 목록은 늘 돌려주고, 저장(PATCH)은 테스트가 정한다.
function renderSelect(initial: string | null, patch: () => Promise<unknown>) {
  clientApi.mockImplementation((_path, init) =>
    init?.method === 'PATCH'
      ? patch()
      : Promise.resolve([
          wf('w1', '디스코드'),
          wf('w2', '실패 알림'),
          wf('w3', '주간 리포트'),
        ]),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FailureWorkflowSelect workflowId="w1" initial={initial} />
    </QueryClientProvider>,
  );
}

const select = () => screen.getByLabelText('실패하면 실행할 워크플로우');

async function choose(option: string) {
  fireEvent.click(select());
  // Base UI Select 항목은 pointerdown 없이 click만 오면 고르지 않는다.
  const item = await screen.findByRole('option', { name: option });
  fireEvent.pointerDown(item);
  fireEvent.click(item);
}

const patchBodies = () =>
  clientApi.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([path, init]) => [path, JSON.parse(init?.body as string) as unknown]);

describe('FailureWorkflowSelect', () => {
  it('고르면 바로 저장하고, "없음"은 null로 보낸다. 자기 자신은 고를 수 없다', async () => {
    renderSelect(null, () => Promise.resolve(undefined));

    await choose('실패 알림');
    expect(await screen.findByText('저장됨')).toBeTruthy();

    fireEvent.click(select());
    await screen.findByRole('option', { name: '주간 리포트' });
    expect(screen.queryByRole('option', { name: '디스코드' })).toBeNull();
    const none = screen.getByRole('option', { name: '없음' });
    fireEvent.pointerDown(none);
    fireEvent.click(none);

    await vi.waitFor(() => expect(patchBodies()).toHaveLength(2));
    expect(patchBodies()).toEqual([
      ['/workflows/w1/failure-workflow', { failureWorkflowId: 'w2' }],
      ['/workflows/w1/failure-workflow', { failureWorkflowId: null }],
    ]);
  });

  it('저장에 실패하면 이전 값으로 되돌리고 사유를 보여 준다', async () => {
    renderSelect('w2', () =>
      Promise.reject(new Error('워크플로우를 찾을 수 없습니다')),
    );
    await vi.waitFor(() => expect(select().textContent).toContain('실패 알림'));

    await choose('주간 리포트');
    expect(
      await screen.findByText('워크플로우를 찾을 수 없습니다'),
    ).toBeTruthy();
    expect(select().textContent).toContain('실패 알림');
    expect(screen.queryByText('저장됨')).toBeNull();
  });
});
