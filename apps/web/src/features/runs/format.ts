import type { BadgeTone } from '@/components/ui/badge';
import type { NodeRunStatus, RunListItem } from './schemas';

export const RUN_STATUS_LABEL: Record<RunListItem['status'], string> = {
  PENDING: '대기 중',
  RUNNING: '실행 중',
  SUCCESS: '성공',
  FAILED: '실패',
};

// 실행 상태는 Badge 하나로 보여 준다(DESIGN.md).
export const RUN_STATUS_TONE: Record<RunListItem['status'], BadgeTone> = {
  PENDING: 'neutral',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'danger',
};

export const RUN_KIND_LABEL: Record<RunListItem['kind'], string> = {
  MANUAL: '직접',
  SCHEDULE: '스케줄',
  FAILURE: '실패 알림',
};

export const NODE_RUN_LABEL: Record<NodeRunStatus, string> = {
  RUNNING: '실행 중',
  SUCCESS: '성공',
  FAILED: '실패',
  SKIPPED: '건너뜀',
};

// 걸린 시간 표기를 한 곳에서 맞춘다: 1초 미만 "980ms", 1분 미만 "1.4초", 그 이상 "2분 3초".
export function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}초`;
  return `${Math.floor(sec / 60)}분 ${Math.round(sec % 60)}초`;
}

// 시작과 끝이 모두 있을 때만.
export function formatDuration(
  startedAt: string | null,
  finishedAt: string | null,
) {
  if (!startedAt || !finishedAt) return '';
  return formatMs(Date.parse(finishedAt) - Date.parse(startedAt));
}
