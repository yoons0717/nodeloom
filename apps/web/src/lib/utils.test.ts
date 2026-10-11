import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('더한 글자 단계는 글자색과 함께 남고, 다른 글자 크기와는 겹치면 뒤의 것이 이긴다', () => {
    expect(cn('text-body-sm text-label')).toBe('text-body-sm text-label');
    expect(cn('text-caption', 'text-muted-foreground')).toBe(
      'text-caption text-muted-foreground',
    );
    expect(cn('text-sm', 'text-body-sm')).toBe('text-body-sm');
  });
});
