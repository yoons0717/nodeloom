import type { NodeRunStatus, RunListItem } from './schemas';

export const RUN_STATUS_LABEL: Record<RunListItem['status'], string> = {
  PENDING: '대기 중',
  RUNNING: '실행 중',
  SUCCESS: '성공',
  FAILED: '실패',
};

export const RUN_STATUS_CLASS: Record<RunListItem['status'], string> = {
  PENDING: 'text-muted-foreground',
  RUNNING: 'text-muted-foreground',
  SUCCESS: 'text-primary',
  FAILED: 'text-danger-text',
};

export const RUN_KIND_LABEL: Record<RunListItem['kind'], string> = {
  MANUAL: '직접',
  SCHEDULE: '스케줄',
  FAILURE: '실패 알림',
};

// 시작과 끝이 모두 있을 때만. 1분이 넘으면 분·초로.
export function formatDuration(
  startedAt: string | null,
  finishedAt: string | null,
) {
  if (!startedAt || !finishedAt) return '';
  const sec = (Date.parse(finishedAt) - Date.parse(startedAt)) / 1000;
  if (sec < 60) return `${sec.toFixed(1)}초`;
  return `${Math.floor(sec / 60)}분 ${Math.round(sec % 60)}초`;
}

// 실행 상세 캔버스의 노드 카드. 색만으로 구분하지 않도록 글자도 함께 보여 준다.
export const NODE_RUN_STATUS: Record<
  NodeRunStatus,
  { label: string; className: string }
> = {
  RUNNING: { label: '실행 중…', className: 'border-muted-foreground' },
  SUCCESS: { label: '성공', className: 'border-primary' },
  FAILED: { label: '실패', className: 'border-danger' },
  SKIPPED: {
    label: '건너뜀',
    className: 'border-dashed border-border opacity-60',
  },
};
