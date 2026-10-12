import { describe, expect, it } from 'vitest';
import { formatDuration, formatMs } from './format';

describe('formatMs', () => {
  it('1초 미만은 ms, 1분 미만은 초(소수 한 자리), 그 이상은 분·초로 보여 준다', () => {
    expect(formatMs(980)).toBe('980ms');
    expect(formatMs(1400)).toBe('1.4초');
    expect(formatMs(123_000)).toBe('2분 3초');
    expect(
      formatDuration('2026-10-11T00:00:00Z', '2026-10-11T00:00:00.012Z'),
    ).toBe('12ms');
    expect(formatDuration(null, '2026-10-11T00:00:00Z')).toBe('');
  });
});
