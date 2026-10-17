import type { ReactNode } from 'react';
import { MobileNavButton } from '@/components/app-sidebar/sidebar-shell';

// 화면 상단 바(56px). 에디터를 뺀 화면(목록, 실행 기록, 실행 상세)이 같이 쓴다(DESIGN.md).
// title은 "context / title" 꼴로 그린다. 화면 사이 이동은 사이드바가 맡는다(M6 6-g).
export function PageHeader({
  context,
  title,
  status,
  actions,
}: {
  context?: string;
  title: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface px-6">
      <MobileNavButton />
      <h1 className="flex min-w-0 items-center gap-2 text-base">
        {/* 좁은 화면에서는 맥락을 숨겨 지금 화면 이름이 보이게 한다. */}
        {context && (
          <span className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="truncate text-muted-foreground">{context}</span>
            <span aria-hidden className="text-disabled">
              /
            </span>
          </span>
        )}
        <span className="truncate font-bold">{title}</span>
      </h1>
      {status}
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
