// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DeleteWorkflowDialog,
  DeleteWorkflowSection,
  objectParticle,
} from './delete-workflow-dialog';
import { WorkflowRowMenu } from './workflow-row-menu';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const clientApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/client-api', () => ({ clientApi }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const wf = { id: 'w1', name: '디스코드', cron: '0 7 * * *' };

function Harness({ onDeleted = vi.fn() }: { onDeleted?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <DeleteWorkflowDialog
        workflow={wf}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>
  );
}

describe('DeleteWorkflowDialog', () => {
  it('스케줄과 실패 알림 안내를 보여 주고 포커스는 취소에서 시작한다', async () => {
    render(<Harness />);
    expect(
      screen.getByRole('alertdialog', { name: "'디스코드'를 삭제할까요?" }),
    ).toBeTruthy();
    expect(screen.getByText(/매일 07:00 스케줄도 멈춥니다/)).toBeTruthy();
    expect(screen.getByText(/'없음'이 됩니다/)).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: '취소' }),
      ),
    );
  });

  it('지우는 동안에는 Esc로 닫히지 않고 버튼이 "삭제 중"으로 막힌다', async () => {
    clientApi.mockReturnValue(new Promise(() => {}));
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    const busy = await screen.findByRole('button', { name: '삭제 중' });
    expect(busy.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(clientApi).toHaveBeenCalledWith('/workflows/w1', {
      method: 'DELETE',
    });
  });

  it('실패하면 창 안에 사유를 보여 주고 닫지 않는다', async () => {
    clientApi.mockRejectedValue(
      new Error('실행 중인 워크플로우는 삭제할 수 없습니다'),
    );
    const onDeleted = vi.fn();
    render(<Harness onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(
      await screen.findByText('실행 중인 워크플로우는 삭제할 수 없습니다'),
    ).toBeTruthy();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: '삭제' })).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe('DeleteWorkflowSection', () => {
  it('지우면 refresh가 아니라 목록으로 replace한다', async () => {
    clientApi.mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DeleteWorkflowSection workflow={{ ...wf, cron: null }} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(
      screen.getByText('되돌릴 수 없습니다. 실행 기록도 함께 지워집니다.'),
    ).toBeTruthy();
    // 구역 버튼과 확인 창 버튼이 둘 다 "삭제"라 창 안에서 찾는다.
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe('WorkflowRowMenu', () => {
  it('⋯ 메뉴의 "삭제"를 누르면 확인 창이 열린다', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkflowRowMenu workflow={wf} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '디스코드 메뉴' }));
    expect(
      (await screen.findByRole('menuitem', { name: '실행 기록' })).getAttribute(
        'href',
      ),
    ).toBe('/w/w1/runs');
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
  });

  it('지우면 목록을 새로 그리고, 행이 빠질 때까지 창은 "삭제 중"으로 남는다', async () => {
    clientApi.mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkflowRowMenu workflow={wf} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '디스코드 메뉴' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '삭제' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '삭제 중' })).toBeTruthy();
  });
});

describe('objectParticle', () => {
  it('받침에 따라 을/를을 고른다', () => {
    expect(objectParticle('실패 알림')).toBe('을');
    expect(objectParticle('디스코드')).toBe('를');
    expect(objectParticle('Discord')).toBe('을(를)');
  });
});
