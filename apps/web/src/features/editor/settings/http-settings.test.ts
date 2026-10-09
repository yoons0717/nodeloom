import { describe, expect, it } from 'vitest';
import { worstCaseSeconds } from './http-settings';

describe('worstCaseSeconds', () => {
  it('제한 시간 × 시도 횟수 + 재시도 대기(최대 흔들림)', () => {
    expect(worstCaseSeconds(10, 0)).toBe(10);
    // 10초 × 3번 + (1 + 2) × 1.25
    expect(worstCaseSeconds(10, 2)).toBe(34);
    // 30초 × 6번 + (1 + 2 + 4 + 8 + 16) × 1.25
    expect(worstCaseSeconds(30, 5)).toBe(219);
  });
});
