'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  History,
  LayoutList,
  LogOut,
  Pencil,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { runSummarySchema } from '@/features/runs/schemas';
import { useCreateWorkflow } from '@/features/workflows/new-workflow-button';
import { workflowListSchema } from '@/features/workflows/schemas';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { useSidebarState } from './sidebar-context';

type Workflow = z.output<typeof workflowListSchema>[number];
type Section = 'workflows' | 'runs' | 'edit' | 'history' | 'settings';

// 주소로 지금 어느 항목에 있는지 정한다. 실행 상세는 "실행 기록"을 활성으로 본다.
export function locate(pathname: string): {
  section: Section | null;
  workflowId: string | null;
} {
  if (pathname === '/') return { section: 'workflows', workflowId: null };
  if (pathname === '/runs') return { section: 'runs', workflowId: null };
  const m = /^\/w\/([^/]+)(\/runs(\/.*)?|\/settings)?$/.exec(pathname);
  if (!m) return { section: null, workflowId: null };
  const section = !m[2]
    ? 'edit'
    : m[2].startsWith('/runs')
      ? 'history'
      : 'settings';
  return { section, workflowId: m[1] ?? null };
}

const FOCUS =
  'outline-none focus-visible:ring-3 focus-visible:ring-accent-ring';
const ITEM = cn(
  'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-body-sm text-label hover:bg-raised-hover hover:text-foreground',
  FOCUS,
);
const ICON_ITEM = cn(
  'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-raised-hover hover:text-foreground',
  FOCUS,
);
const ACTIVE =
  'bg-accent-soft font-medium text-foreground hover:bg-accent-soft';

const DOT: Record<NonNullable<Workflow['lastRun']>['status'], string> = {
  SUCCESS: 'bg-success',
  FAILED: 'bg-danger',
  RUNNING: 'bg-accent',
  PENDING: 'bg-accent',
};

// 공통 왼쪽 사이드바(M6 6-g, DESIGN.md). 화면 이동은 여기서 맡는다.
// 펼침 240px, 접힘 56px(아이콘 + 툴팁). 접힘 상태는 SidebarShell이 정한다.
export function AppSidebar({
  role,
  initialWorkflows,
  forceExpanded = false,
  onNavigate,
}: {
  role: 'admin' | 'demo';
  initialWorkflows: Workflow[];
  // 모바일 드로어는 늘 펼친 모양이다.
  forceExpanded?: boolean;
  // 모바일 드로어에서 이동하면 닫는다.
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const state = useSidebarState();
  const collapsed = !forceExpanded && (state?.collapsed ?? false);
  const { section, workflowId } = locate(pathname);
  const search = useRef<HTMLInputElement>(null);
  const focusAfterExpand = useRef(false);
  const [query, setQuery] = useState('');
  // 사용자가 직접 펼치거나 접은 것만 기억한다. 나머지는 지금 보고 있는 워크플로우만 펼친다.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => toggled[id] ?? id === workflowId;
  const create = useCreateWorkflow();

  // 목록 화면·실패 알림 선택과 같은 캐시를 쓴다.
  const workflows = useQuery({
    queryKey: ['workflows'],
    queryFn: async () =>
      workflowListSchema.parse(await clientApi('/workflows')),
    initialData: initialWorkflows,
  });
  // 끝나지 않은 실행이 있을 때만 30초마다 다시 불러온다.
  const summary = useQuery({
    queryKey: ['run-summary'],
    queryFn: async () =>
      runSummarySchema.parse(await clientApi('/runs/summary')),
    refetchInterval: (q) => (q.state.data?.running ? 30_000 : false),
  });

  // 찾기 칸으로. 접혀 있으면 펼친 뒤 포커스한다.
  const focusSearch = () => {
    if (collapsed) {
      focusAfterExpand.current = true;
      state?.setCollapsed(false);
    } else search.current?.focus();
  };
  useEffect(() => {
    if (!collapsed && focusAfterExpand.current) {
      focusAfterExpand.current = false;
      search.current?.focus();
    }
  }, [collapsed]);

  // ⌘K / Ctrl+K. 모바일 드로어 쪽(forceExpanded)은 듣지 않는다.
  useEffect(() => {
    if (forceExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const q = query.trim().toLowerCase();
  const visible = workflows.data.filter(
    (w) => !q || w.name.toLowerCase().includes(q),
  );
  const toggle = (id: string) =>
    setToggled((t) => ({ ...t, [id]: !isOpen(id) }));
  const failed = summary.data?.failedLast24h ?? 0;
  const failedBadge = failed > 0 && (
    <Badge
      tone="danger"
      aria-label={`최근 24시간 실패 ${failed}건`}
      className={collapsed ? 'absolute -top-1 -right-1 px-1' : 'ml-auto'}
    >
      {failed}
    </Badge>
  );
  const subItems = (id: string, count: number) => [
    {
      href: `/w/${id}`,
      label: '편집',
      icon: <Pencil className="size-3.5" />,
      active: id === workflowId && section === 'edit',
    },
    {
      href: `/w/${id}/runs`,
      label: '실행 기록',
      icon: <History className="size-3.5" />,
      active: id === workflowId && section === 'history',
      extra: (
        <span className="ml-auto font-mono text-caption text-muted-foreground">
          {count}
        </span>
      ),
    },
    {
      href: `/w/${id}/settings`,
      label: '설정',
      icon: <Settings className="size-3.5" />,
      active: id === workflowId && section === 'settings',
    },
  ];
  const current = workflows.data.find((w) => w.id === workflowId);
  const logout = () => {
    void clientApi('/auth/logout', { method: 'POST' }).then(() => {
      router.replace('/login');
      router.refresh();
    });
  };
  const roleLabel = role === 'admin' ? '관리자' : '데모 방문자';

  return (
    <nav
      aria-label="주 메뉴"
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border-subtle bg-surface',
        collapsed ? 'w-14 items-center' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2',
          collapsed ? 'justify-center' : 'px-4',
        )}
      >
        {!collapsed && (
          <>
            <span
              aria-hidden
              className="flex size-[22px] items-center justify-center rounded-sm bg-accent text-xs font-bold text-bg"
            >
              N
            </span>
            <span className="font-bold">Nodeloom</span>
          </>
        )}
        {state && !forceExpanded && (
          <Tip label="사이드바 펼치기" enabled={collapsed}>
            <button
              type="button"
              aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
              onClick={() => state.setCollapsed(!collapsed)}
              className={cn(ICON_ITEM, !collapsed && '-mr-2 ml-auto')}
            >
              <span aria-hidden className="text-base">
                {collapsed ? '»' : '«'}
              </span>
            </button>
          </Tip>
        )}
      </div>

      {collapsed ? (
        <Tip label="워크플로우 찾기 (⌘K)" enabled>
          <button
            type="button"
            aria-label="워크플로우 찾기"
            onClick={focusSearch}
            className={cn(ICON_ITEM, 'mb-2')}
          >
            <Search className="size-4" />
          </button>
        </Tip>
      ) : (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={search}
              type="search"
              aria-label="워크플로우 찾기"
              placeholder="워크플로우 찾기"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(
                'h-8 w-full rounded-md border border-border-control bg-bg pr-10 pl-8 text-body-sm placeholder:text-muted-foreground',
                FOCUS,
              )}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border px-1 font-mono text-caption text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>
      )}

      <ul
        className={cn(
          'flex flex-col gap-0.5 pb-3',
          collapsed ? 'items-center' : 'px-3',
        )}
      >
        <li>
          <MenuLink
            href="/"
            label="전체 워크플로우"
            icon={<LayoutList className="size-4" />}
            active={section === 'workflows'}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </li>
        <li>
          <MenuLink
            href="/runs"
            label="모든 실행"
            icon={<History className="size-4" />}
            active={section === 'runs'}
            collapsed={collapsed}
            onNavigate={onNavigate}
            extra={failedBadge}
          />
        </li>
      </ul>

      {collapsed ? (
        // 접힌 상태: 트리는 숨기고 지금 워크플로우의 하위 항목만 아이콘으로.
        current && (
          <ul className="flex flex-col items-center gap-0.5 border-t border-border-subtle pt-3">
            {subItems(current.id, current.runCount).map((item) => (
              <li key={item.href}>
                <MenuLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={item.active}
                  collapsed
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <h2 className="px-5 pb-1 text-caption text-muted-foreground">
            워크플로우
          </h2>
          {/* TODO: role="tree"와 방향키 이동은 아직. 버튼 + aria-expanded로 펼친다(M6 6-g). */}
          <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {visible.map((w) => {
              const open = isOpen(w.id);
              return (
                <li key={w.id}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${w.name} ${open ? '접기' : '펼치기'}`}
                      onClick={() => toggle(w.id)}
                      className={ICON_ITEM}
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 transition-transform',
                          open && 'rotate-90',
                        )}
                      />
                    </button>
                    <Link
                      href={`/w/${w.id}`}
                      onClick={() => {
                        setToggled((t) => ({ ...t, [w.id]: true }));
                        onNavigate?.();
                      }}
                      className={cn(
                        ITEM,
                        'flex-1',
                        w.id === workflowId && 'text-foreground',
                      )}
                    >
                      <StatusDot run={w.lastRun} />
                      <span className="truncate">{w.name}</span>
                    </Link>
                  </div>
                  {open && (
                    <ul className="ml-[22px] flex flex-col gap-0.5 py-0.5">
                      {subItems(w.id, w.runCount).map((item) => (
                        <li key={item.href}>
                          <MenuLink
                            {...item}
                            collapsed={false}
                            onNavigate={onNavigate}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                {q
                  ? '일치하는 워크플로우가 없습니다'
                  : '아직 워크플로우가 없습니다'}
              </li>
            )}
          </ul>
        </>
      )}

      <div
        className={cn(
          'mt-auto flex shrink-0 flex-col gap-2 border-t border-border-subtle py-3',
          collapsed ? 'items-center' : 'px-3',
        )}
      >
        {collapsed ? (
          <Tip label="새 워크플로우" enabled>
            <button
              type="button"
              aria-label="새 워크플로우"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className={ICON_ITEM}
            >
              <Plus className="size-4" />
            </button>
          </Tip>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            <Plus aria-hidden />
            {create.isPending ? '만드는 중…' : '새 워크플로우'}
          </Button>
        )}
        <div
          className={cn(
            'flex items-center gap-2',
            collapsed ? 'flex-col' : 'h-8 px-1',
          )}
        >
          <span
            aria-hidden
            title={collapsed ? roleLabel : undefined}
            className="flex size-6 items-center justify-center rounded-full bg-raised-hover text-caption font-bold text-label"
          >
            {role === 'admin' ? '관' : '데'}
          </span>
          {!collapsed && (
            <span className="flex-1 text-body-sm text-label">{roleLabel}</span>
          )}
          {role === 'admin' && (
            <Tip label="로그아웃" enabled={collapsed}>
              <button
                type="button"
                aria-label="로그아웃"
                onClick={logout}
                className={ICON_ITEM}
              >
                <LogOut className="size-4" />
              </button>
            </Tip>
          )}
        </div>
      </div>
    </nav>
  );
}

function StatusDot({ run }: { run: Workflow['lastRun'] }) {
  return (
    <span
      aria-hidden
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        run ? DOT[run.status] : 'bg-disabled',
      )}
    />
  );
}

// 접힌 사이드바에서만 툴팁을 단다. 펼친 상태에서는 글자가 보이므로 그대로 둔다.
function Tip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactElement;
}) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function MenuLink({
  href,
  label,
  icon,
  active,
  extra,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  extra?: ReactNode;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Tip label={label} enabled={collapsed}>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? label : undefined}
        onClick={onNavigate}
        className={cn(
          collapsed ? cn(ICON_ITEM, 'relative') : ITEM,
          active && ACTIVE,
        )}
      >
        <span aria-hidden className="text-muted-foreground">
          {icon}
        </span>
        {!collapsed && <span className="truncate">{label}</span>}
        {extra}
      </Link>
    </Tip>
  );
}
