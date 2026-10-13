// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { workflowListSchema } from '@/features/workflows/schemas';
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

type Wf = z.output<typeof workflowListSchema>[number];
const wf = (id: string, name: string, over: Partial<Wf> = {}): Wf => ({
  id,
  name,
  nodeCount: 1,
  cron: null,
  lastRun: null,
  failedLast24h: 0,
  updatedAt: '2026-10-12T00:00:00Z',
  ...over,
});

function renderSidebar(
  pathname: string,
  workflows = [wf('w1', '아침 비 알림'), wf('w2', '평일 보고')],
) {
  nav.pathname = pathname;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(Response.json({ failedLast24h: 2, running: 0 })),
    ),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppSidebar role="admin" initialWorkflows={workflows} />
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

  it('트리 행은 실패와 실행 중만 오른쪽 끝에 보이고, 성공은 표시하지 않는다', () => {
    renderSidebar('/w/w1', [
      wf('w1', '디스코드', {
        lastRun: { status: 'SUCCESS', finishedAt: null },
        failedLast24h: 2,
      }),
      wf('w2', '주간 리포트', {
        lastRun: { status: 'RUNNING', finishedAt: null },
      }),
      wf('w3', '매일 환율 기록', {
        lastRun: { status: 'SUCCESS', finishedAt: null },
      }),
    ]);
    const row = (name: string) =>
      screen.getByText(name).closest('a') as HTMLElement;
    // 마지막 실행이 성공이어도 24시간 안의 실패는 보인다
    expect(row('디스코드').textContent).toContain('2');
    expect(
      row('디스코드').querySelector('[aria-label="최근 24시간 실패 2건"]'),
    ).toBeTruthy();
    expect(row('주간 리포트').textContent).toContain('실행 중');
    expect(row('매일 환율 기록').textContent).toBe('매일 환율 기록');
    // 하위 "실행 기록"에는 실패 건수
    expect(screen.getByLabelText('실패 2건')).toBeTruthy();
  });

  it('새 워크플로우와 로그아웃이 실패하면 사유를 보여 준다', async () => {
    renderSidebar('/');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'POST'
            ? Response.json(
                {
                  message: url.includes('logout')
                    ? '로그아웃하지 못했습니다'
                    : '데모에서는 워크플로우를 20개까지 만들 수 있습니다',
                },
                { status: url.includes('logout') ? 500 : 403 },
              )
            : Response.json({ failedLast24h: 0, running: 0 }),
        ),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /새 워크플로우/ }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      '20개까지',
    );
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '로그아웃하지 못했습니다',
      ),
    );
  });

  it('실행 요약이 바뀌면 워크플로우 목록(상태 표시)도 다시 불러온다', async () => {
    nav.pathname = '/';
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/workflows')
          ? Response.json([wf('w1', '아침 비 알림')])
          : Response.json({ failedLast24h: 0, running: 1 }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AppSidebar
          role="admin"
          initialWorkflows={[wf('w1', '아침 비 알림')]}
        />
      </QueryClientProvider>,
    );
    await vi.waitFor(() =>
      expect(client.getQueryData(['run-summary'])).toBeTruthy(),
    );
    const listCalls = () =>
      fetch.mock.calls.filter(([u]) => u.endsWith('/workflows')).length;
    const before = listCalls();
    // 스케줄 실행이 끝나 실행 중이 0이 되고 실패가 하나 늘었다.
    act(() => {
      client.setQueryData(['run-summary'], { failedLast24h: 1, running: 0 });
    });
    await vi.waitFor(() => expect(listCalls()).toBe(before + 1));
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

  it('에디터에서 접힌 채 시작하고, 펼치면 그 선택을 쿠키에 남긴다', () => {
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
  });

  it('md – lg에서는 펼치기로 본문 위에 겹쳐 열고, 이동하면 닫는다', () => {
    nav.pathname = '/w/w1';
    document.cookie = `${COLLAPSED_KEY}=; max-age=0; path=/`;
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ failedLast24h: 0, running: 0 })),
      ),
    );
    // xl(1280) 미만
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarShell
          role="admin"
          initialWorkflows={[wf('w1', '아침 비 알림')]}
          storedCollapsed={false}
        >
          본문
        </SidebarShell>
      </QueryClientProvider>,
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: '사이드바 펼치기' })[0]!,
    );
    const overlay = screen.getByRole('dialog', { name: '주 메뉴' });
    // 저장값은 바꾸지 않는다.
    expect(document.cookie).not.toContain(COLLAPSED_KEY);
    fireEvent.click(
      within(overlay).getByRole('link', { name: /전체 워크플로우/ }),
    );
    expect(screen.queryByRole('dialog', { name: '주 메뉴' })).toBeNull();
  });

  it('겹쳐 연 사이드바를 Esc로 닫으면 누른 펼치기 버튼으로 포커스가 돌아온다', async () => {
    nav.pathname = '/w/w1';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ failedLast24h: 0, running: 0 })),
      ),
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarShell
          role="admin"
          initialWorkflows={[wf('w1', '아침 비 알림')]}
          storedCollapsed={false}
        >
          본문
        </SidebarShell>
      </QueryClientProvider>,
    );
    // 터치(iPad Safari)처럼 눌러도 버튼에 포커스가 가지 않는 경우
    const expand = screen.getAllByRole('button', {
      name: '사이드바 펼치기',
    })[0]!;
    fireEvent.click(expand);
    fireEvent.keyDown(screen.getByRole('dialog', { name: '주 메뉴' }), {
      key: 'Escape',
    });
    await vi.waitFor(() => expect(document.activeElement).toBe(expand));
  });
});
