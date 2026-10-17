import { cn } from '@/lib/utils';
import type { RunListItem } from './schemas';

// 워크플로우 카드와 실행 기록이 함께 쓰는 상태 표시(DESIGN.md 워크플로우 카드).
// 색은 점에만 쓰고, 글자에 색을 넣는 건 실패뿐이다. none은 아직 실행하지 않은 워크플로우다.
export type StatusTone = 'fail' | 'run' | 'pending' | 'ok' | 'none';

export const RUN_STATUS_DOT: Record<RunListItem['status'], StatusTone> = {
  FAILED: 'fail',
  RUNNING: 'run',
  PENDING: 'pending',
  SUCCESS: 'ok',
};

const DOT: Record<StatusTone, string> = {
  fail: 'bg-danger',
  run: 'bg-accent ring-3 ring-accent-ring',
  pending: 'border-[1.5px] border-muted-foreground',
  ok: 'bg-success',
  none: 'border-[1.5px] border-dashed border-border-control',
};

export const STATUS_TEXT: Record<StatusTone, string> = {
  fail: 'font-medium text-danger-text',
  run: 'text-label',
  pending: 'text-label',
  ok: 'text-muted-foreground',
  none: 'text-muted-foreground',
};

export function StatusDot({ tone }: { tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 rounded-full', DOT[tone])}
    />
  );
}
