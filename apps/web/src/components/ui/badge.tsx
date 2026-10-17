import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone =
  'neutral' | 'running' | 'success' | 'warning' | 'danger';

const TONE: Record<BadgeTone, { className: string; glyph?: string }> = {
  neutral: { className: 'bg-raised-hover text-label' },
  running: { className: 'bg-accent-soft text-accent', glyph: '●' },
  success: { className: 'bg-success-soft text-success-text', glyph: '✓' },
  warning: { className: 'bg-warning-soft text-warning-text', glyph: '▲' },
  danger: { className: 'bg-danger-soft text-danger-text', glyph: '!' },
};

// 배지로 보여 주는 상태 표시. 색에만 기대지 않도록 글리프를 함께 붙인다(DESIGN.md). 목록의 실행 상태는 status-dot.tsx.
function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: ComponentProps<'span'> & { tone?: BadgeTone }) {
  const { className: toneClass, glyph } = TONE[tone];
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex h-[22px] w-fit shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap',
        toneClass,
        className,
      )}
      {...props}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      {children}
    </span>
  );
}

export { Badge };
