// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGraph } from '@/features/editor/commands';
import { WorkflowEditor } from './workflow-editor';

// React Flow 없이 에디터가 그려졌는지만 본다.
vi.mock('@/features/editor/editor', () => ({
  Editor: () => <div>에디터</div>,
  GraphIssueBadge: () => null,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 폭 조건(min-width: 768px)을 바꿀 수 있는 matchMedia
function stubWidth(wide: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: wide,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mq),
  );
  return (next: boolean) => {
    mq.matches = next;
    act(() => listeners.forEach((fn) => fn()));
  };
}

const workflow = {
  id: 'wf-1',
  name: '아침 알림',
  graph: createInitialGraph(),
  failureWorkflowId: null,
};

describe('WorkflowEditor', () => {
  it('좁은 화면에서는 에디터를 그리지 않고, 실행 기록과 설정으로 가는 버튼을 보여 준다', () => {
    stubWidth(false);
    render(<WorkflowEditor workflow={workflow} />);
    expect(screen.queryByText('에디터')).toBeNull();
    expect(
      screen.getByRole('link', { name: '실행 기록 보기' }).getAttribute('href'),
    ).toBe('/w/wf-1/runs');
    expect(
      screen.getByRole('link', { name: '설정' }).getAttribute('href'),
    ).toBe('/w/wf-1/settings');
  });

  it('넓어지면 에디터를 그리고, 다시 좁아지면 내린다', () => {
    const setWide = stubWidth(false);
    render(<WorkflowEditor workflow={workflow} />);
    setWide(true);
    expect(screen.getByText('에디터')).toBeTruthy();
    setWide(false);
    expect(screen.queryByText('에디터')).toBeNull();
  });
});
