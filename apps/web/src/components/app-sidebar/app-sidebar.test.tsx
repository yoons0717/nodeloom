// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar, locate } from './app-sidebar';
import { COLLAPSED_KEY, resolveCollapsed, SidebarShell } from './sidebar-shell';

const nav = vi.hoisted(() => ({ pathname: '/', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const wf = (id: string, name: string) => ({
  id,
  name,
  nodeCount: 1,
  cron: null,
  lastRun: null,
  runCount: 3,
  updatedAt: '2026-10-12T00:00:00Z',
});

function renderSidebar(pathname: string) {
  nav.pathname = pathname;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(Response.json({ failedLast24h: 2, running: 0 })),
    ),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppSidebar
        role="admin"
        initialWorkflows={[wf('w1', '아침 비 알림'), wf('w2', '평일 보고')]}
      />
    </QueryClientProvider>,
  );
}

describe('locate', () => {
  it('주소로 활성 항목을 정하고, 실행 상세는 실행 기록으로 본다', () => {
    expect(locate('/')).toEqual({ section: 'workflows', workflowId: null });
    expect(locate('/runs')).toEqual({ section: 'runs', workflowId: null });
    expect(locate('/w/a')).toEqual({ section: 'edit', workflowId: 'a' });
    expect(locate('/w/a/runs/r1')).toEqual({
      section: 'history',
      workflowId: 'a',
    });
    expect(locate('/w/a/settings')).toEqual({
      section: 'settings',
      workflowId: 'a',
    });
    expect(locate('/login')).toEqual({ section: null, workflowId: null });
  });
});

describe('AppSidebar', () => {
  it('지금 워크플로우를 펼치고 활성 항목에 aria-current를 붙인다', async () => {
    renderSidebar('/w/w1/runs/r9');
    const history = screen.getByRole('link', { name: /실행 기록/ });
    expect(history.getAttribute('aria-current')).toBe('page');
    expect(history.getAttribute('href')).toBe('/w/w1/runs');
    // 다른 워크플로우는 접혀 있다
    expect(
      screen
        .getByRole('button', { name: '평일 보고 펼치기' })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    // 24시간 실패 수
    expect(await screen.findByLabelText('최근 24시간 실패 2건')).toBeTruthy();
  });

  it('화살표는 이동 없이 펼치기만 하고, 찾기는 이름으로 거른다', () => {
    renderSidebar('/');
    fireEvent.click(screen.getByRole('button', { name: '평일 보고 펼치기' }));
    expect(nav.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /설정/ }).getAttribute('href'),
    ).toBe('/w/w2/settings');
    fireEvent.change(screen.getByLabelText('워크플로우 찾기'), {
      target: { value: '아침' },
    });
    expect(screen.queryByText('평일 보고')).toBeNull();
    expect(screen.getByText('아침 비 알림')).toBeTruthy();
  });
});

describe('접기', () => {
  it('고른 적이 없으면 에디터에서만 접고, 고른 값이 있으면 그것을 따른다', () => {
    expect(resolveCollapsed(null, '/w/a')).toBe(true);
    expect(resolveCollapsed(null, '/w/a/runs')).toBe(false);
    expect(resolveCollapsed(false, '/w/a')).toBe(false);
    expect(resolveCollapsed(true, '/')).toBe(true);
  });

  it('에디터에서 접힌 채 시작하고, 펼치면 그 선택을 쿠키와 localStorage에 남긴다', () => {
    nav.pathname = '/w/w1';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ failedLast24h: 0, running: 0 })),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarShell
          role="admin"
          initialWorkflows={[wf('w1', '아침 비 알림')]}
          storedCollapsed={null}
        >
          본문
        </SidebarShell>
      </QueryClientProvider>,
    );
    // 접힌 상태: 트리 대신 지금 워크플로우의 하위 항목만 아이콘으로
    expect(
      screen.queryByLabelText('워크플로우 찾기', { selector: 'input' }),
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: '실행 기록' }).getAttribute('href'),
    ).toBe('/w/w1/runs');
    fireEvent.click(screen.getByRole('button', { name: '사이드바 펼치기' }));
    expect(screen.getByRole('button', { name: '사이드바 접기' })).toBeTruthy();
    expect(document.cookie).toContain(`${COLLAPSED_KEY}=0`);
    expect(localStorage.getItem(COLLAPSED_KEY)).toBe('0');
  });
});
