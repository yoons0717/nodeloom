import { describe, expect, it } from 'vitest';
import { parseSchedule, toCron } from './schedule';

describe('반복 선택 ↔ cron', () => {
  it('선택지에 맞는 cron은 그 선택지로 읽고, 다시 같은 cron으로 만든다', () => {
    const cases = [
      ['0 9 * * *', { kind: 'daily', hour: 9, minute: 0 }],
      ['30 8 * * 1-5', { kind: 'weekdays', hour: 8, minute: 30 }],
      ['0 7 * * 0', { kind: 'weekly', day: 0, hour: 7, minute: 0 }],
      ['15 * * * *', { kind: 'hourly', minute: 15 }],
    ] as const;
    for (const [cron, schedule] of cases) {
      expect(parseSchedule(cron)).toEqual(schedule);
      expect(toCron(schedule)).toBe(cron);
    }
  });

  it('없으면 반복 안 함, 선택지에 없는 모양은 직접 입력으로 읽는다', () => {
    expect(parseSchedule(null)).toEqual({ kind: 'none' });
    expect(toCron({ kind: 'none' })).toBeNull();
    for (const cron of ['*/15 9-18 * * 1-5', '0 9 1 * *', '0 25 * * *', '']) {
      expect(parseSchedule(cron)).toEqual({ kind: 'custom', cron });
    }
    expect(toCron({ kind: 'custom', cron: ' ' })).toBeNull();
  });
});
