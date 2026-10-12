// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteWorkflowButton } from './delete-workflow-button';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe('DeleteWorkflowButton', () => {
  it('누른 클릭이 행(링크)으로 번지지 않고 확인 단계로 바뀐다', () => {
    const rowClick = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <div onClick={rowClick}>
          <DeleteWorkflowButton id="w1" name="아침 비 알림" />
        </div>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '아침 비 알림 삭제' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(rowClick).not.toHaveBeenCalled();
  });
});
