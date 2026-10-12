'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AppSidebar, locate } from './app-sidebar';
import { SidebarContext, useSidebarState } from './sidebar-context';

export const COLLAPSED_KEY = 'nodeloom.sidebar.collapsed';

// 접힘을 고른 적이 없으면 에디터에서만 접는다(캔버스 폭 확보). 한 번 고르면 그 선택을 따른다(M6 6-g).
export function resolveCollapsed(stored: boolean | null, pathname: string) {
  return stored ?? locate(pathname).section === 'edit';
}

// 사이드바와 본문 틀. 접힘 상태는 쿠키(서버가 처음 그릴 때 읽어 hydration이 어긋나지 않게)와 localStorage에 둔다.
export function SidebarShell({
  role,
  initialWorkflows,
  storedCollapsed,
  children,
}: {
  role: 'admin' | 'demo';
  initialWorkflows: Parameters<typeof AppSidebar>[0]['initialWorkflows'];
  storedCollapsed: boolean | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [stored, setStored] = useState(storedCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = resolveCollapsed(stored, pathname);

  const setCollapsed = useCallback((v: boolean) => {
    setStored(v);
    document.cookie = `${COLLAPSED_KEY}=${v ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0');
    } catch {
      // 사생활 보호 모드 등에서는 쿠키만으로 충분하다.
    }
  }, []);
  const value = useMemo(
    () => ({ collapsed, setCollapsed, openMobile: () => setMobileOpen(true) }),
    [collapsed, setCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>
      <TooltipProvider>
        <div className="flex h-dvh">
          <div className="hidden md:block">
            <AppSidebar role={role} initialWorkflows={initialWorkflows} />
          </div>
          {/* md 미만: 왼쪽 드로어. 이동하면 닫는다. */}
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-scrim md:hidden" />
              <Dialog.Popup
                aria-label="주 메뉴"
                className="fixed inset-y-0 left-0 z-50 shadow-md outline-none md:hidden"
              >
                <AppSidebar
                  role={role}
                  initialWorkflows={initialWorkflows}
                  forceExpanded
                  onNavigate={() => setMobileOpen(false)}
                />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            {children}
          </main>
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

// 좁은 화면에서 머리말 왼쪽에 두는 메뉴 버튼. 넓은 화면에서는 보이지 않는다.
export function MobileNavButton({ className }: { className?: string }) {
  const state = useSidebarState();
  return (
    <button
      type="button"
      aria-label="메뉴 열기"
      onClick={() => state?.openMobile()}
      className={cn(
        '-ml-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-raised-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-accent-ring md:hidden',
        className,
      )}
    >
      <Menu className="size-5" />
    </button>
  );
}
