import type { NodeType } from '@nodeloom/core';
import { cn } from '@/lib/utils';
import { NODE_META } from './node-meta';

// 노드 종류를 색과 글리프로 보여 주는 칩. sm은 노드 카드(18px), xs는 노드 목록 도움말 제목(20px), md는 노드 목록(24px).
export function NodeGlyph({
  type,
  size = 'sm',
}: {
  type: NodeType;
  size?: 'sm' | 'xs' | 'md';
}) {
  const meta = NODE_META[type];
  const text =
    size !== 'md'
      ? meta.smallGlyph
        ? 'text-glyph-sm'
        : 'text-caption'
      : meta.smallGlyph
        ? 'text-caption'
        : 'text-body-sm';
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center leading-none',
        size === 'sm' && 'size-[18px] rounded-sm',
        size === 'xs' && 'size-5 rounded-sm',
        size === 'md' && 'size-6 rounded-md',
        meta.chipClass,
        text,
        meta.glyphClass,
      )}
    >
      {meta.glyph}
    </span>
  );
}
