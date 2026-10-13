import { describe, expect, it } from 'vitest';
import { groupRunsByDay, parseRunFilter } from './run-list';
import type { RunListItem } from './schemas';

const run = (
  id: string,
  startedAt: string,
  status: RunListItem['status'] = 'SUCCESS',
): RunListItem => ({
  id,
  status,
  kind: 'MANUAL',
  error: null,
  createdAt: startedAt,
  startedAt,
  finishedAt: startedAt,
});

describe('groupRunsByDay', () => {
  it('APP_TIMEZONE(서울) 날짜로 묶고 오늘·어제·그 밖의 날짜로 부른다', () => {
    const now = new Date('2026-10-11T03:00:00Z'); // 서울 10월 11일 12:00
    const groups = groupRunsByDay(
      [
        run('a', '2026-10-11T01:00:00Z'), // 서울 11일
        run('b', '2026-10-10T16:30:00Z'), // 서울 11일 01:30
        run('c', '2026-10-10T14:00:00Z'), // 서울 10일 23:00
        run('d', '2026-10-08T23:00:00Z'), // 서울 9일
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.runs.map((r) => r.id)])).toEqual([
      ['오늘', ['a', 'b']],
      ['어제', ['c']],
      ['10월 9일', ['d']],
    ]);
  });
});

describe('parseRunFilter', () => {
  it('알 수 없는 값은 전체로 본다', () => {
    expect(parseRunFilter('failed')).toBe('failed');
    expect(parseRunFilter('nope')).toBe('all');
    expect(parseRunFilter(undefined)).toBe('all');
  });
});
