'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AppSidebar, locate } from './app-sidebar';
import { COLLAPSED_KEY } from './sidebar-constants';
import { SidebarContext, useSidebarState } from './sidebar-context';

export { COLLAPSED_KEY };

// 접힘을 고른 적이 없으면 에디터에서만 접는다(캔버스 폭 확보). 한 번 고르면 그 선택을 따른다(M6 6-g).
export function resolveCollapsed(stored: boolean | null, pathname: string) {
  return stored ?? locate(pathname).section === 'edit';
}

// 사이드바와 본문 틀. 접힘 상태는 쿠키에 둔다(서버가 처음 그릴 때 읽어 hydration이 어긋나지 않게).
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
  // md – lg에서 겹쳐 연 사이드바. 닫히면 연 버튼으로 포커스를 돌려준다.
  const [overlay, setOverlay] = useState<{ search: boolean } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const collapsed = resolveCollapsed(stored, pathname);

  const setCollapsed = useCallback((v: boolean) => {
    setStored(v);
    document.cookie = `${COLLAPSED_KEY}=${v ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      openMobile: () => setMobileOpen(true),
      openOverlay: (search = false) => {
        opener.current = document.activeElement as HTMLElement | null;
        setOverlay({ search });
      },
    }),
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
                className="fixed inset-y-0 left-0 z-50 bg-surface pl-[env(safe-area-inset-left)] shadow-md outline-none md:hidden"
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
          {/* md – lg: 레일의 펼치기로 본문 위에 겹쳐 연다. 본문을 밀지 않고, 바깥·Esc·이동으로 닫는다. */}
          <Dialog.Root
            open={overlay !== null}
            onOpenChange={(open) => !open && setOverlay(null)}
            modal={false}
          >
            <Dialog.Portal>
              <Dialog.Popup
                aria-label="주 메뉴"
                finalFocus={opener}
                className="fixed inset-y-0 left-0 z-40 hidden bg-surface pl-[env(safe-area-inset-left)] shadow-md outline-none md:block xl:hidden"
              >
                <AppSidebar
                  role={role}
                  initialWorkflows={initialWorkflows}
                  forceExpanded
                  autoFocusSearch={overlay?.search}
                  onNavigate={() => setOverlay(null)}
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
