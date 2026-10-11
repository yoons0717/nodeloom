import { describe, expect, it } from 'vitest';
import { nextCronRuns } from './cron.js';

describe('nextCronRuns', () => {
  it('지정한 시간대 기준으로 다음 실행 시각을 계산한다', () => {
    const from = new Date('2026-10-11T00:00:00Z'); // 서울 09:00
    const runs = nextCronRuns('0 7 * * *', 'Asia/Seoul', 2, from);
    // 서울 7시 = UTC 22시(전날)
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-10-11T22:00:00.000Z',
      '2026-10-12T22:00:00.000Z',
    ]);
    expect(nextCronRuns('0 7 * * *', 'UTC', 1, from)[0]!.toISOString()).toBe(
      '2026-10-11T07:00:00.000Z',
    );
  });
});
