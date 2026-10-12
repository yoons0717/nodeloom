import { dayKey } from '@/features/workflows/format';
import type { RunListItem } from './schemas';

export type RunFilter = 'all' | 'failed' | 'success' | 'running';

export const RUN_FILTERS: { value: RunFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'failed', label: '실패' },
  { value: 'success', label: '성공' },
  { value: 'running', label: '실행 중' },
];

// 거르기 결과가 0건일 때 문구
export const EMPTY_FILTER_MESSAGE: Record<Exclude<RunFilter, 'all'>, string> = {
  failed: '실패한 실행이 없습니다',
  success: '성공한 실행이 없습니다',
  running: '실행 중인 실행이 없습니다',
};

export function parseRunFilter(value: unknown): RunFilter {
  return RUN_FILTERS.some((f) => f.value === value)
    ? (value as RunFilter)
    : 'all';
}

// 대기 중도 "실행 중"으로 친다(아직 끝나지 않음).
export function matchesFilter(run: RunListItem, filter: RunFilter) {
  switch (filter) {
    case 'all':
      return true;
    case 'failed':
      return run.status === 'FAILED';
    case 'success':
      return run.status === 'SUCCESS';
    case 'running':
      return run.status === 'PENDING' || run.status === 'RUNNING';
  }
}

const dayLabelFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
});

// 날짜별 묶음. 목록은 이미 최근 순이라 순서를 그대로 쓴다. 머리글은 오늘 / 어제 / 10월 9일.
export function groupRunsByDay(runs: RunListItem[], now: Date) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 24 * 60 * 60_000));
  const groups: { key: string; label: string; runs: RunListItem[] }[] = [];
  for (const run of runs) {
    const key = dayKey(run.startedAt ?? run.createdAt);
    let group = groups.at(-1);
    if (group?.key !== key) {
      const label =
        key === today
          ? '오늘'
          : key === yesterday
            ? '어제'
            : dayLabelFormatter.format(new Date(`${key}T00:00:00Z`));
      group = { key, label, runs: [] };
      groups.push(group);
    }
    group.runs.push(run);
  }
  return groups;
}
