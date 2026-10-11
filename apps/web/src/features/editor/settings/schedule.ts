// Trigger 설정의 "반복" 선택지. 저장은 언제나 cron 문자열이고, 화면에서만 선택지로 바꿔 보여 준다.
export type Schedule =
  | { kind: 'none' }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekdays'; hour: number; minute: number }
  | { kind: 'weekly'; day: number; hour: number; minute: number }
  | { kind: 'hourly'; minute: number }
  | { kind: 'custom'; cron: string };

const num = (s: string, max: number) =>
  /^\d{1,2}$/.test(s) && Number(s) <= max ? Number(s) : undefined;

// 선택지로 만들 수 있는 모양이 아니면 직접 입력으로 본다.
export function parseSchedule(cron: string | null): Schedule {
  if (cron === null) return { kind: 'none' };
  const [m, h, dom, mon, dow, ...rest] = cron.trim().split(/\s+/);
  const minute = num(m ?? '', 59);
  const custom = { kind: 'custom', cron } as const;
  if (rest.length > 0 || dom !== '*' || mon !== '*' || minute === undefined)
    return custom;
  if (h === '*') return dow === '*' ? { kind: 'hourly', minute } : custom;
  const hour = num(h ?? '', 23);
  if (hour === undefined) return custom;
  if (dow === '*') return { kind: 'daily', hour, minute };
  if (dow === '1-5') return { kind: 'weekdays', hour, minute };
  const day = num(dow ?? '', 6);
  return day === undefined ? custom : { kind: 'weekly', day, hour, minute };
}

export function toCron(s: Schedule): string | null {
  switch (s.kind) {
    case 'none':
      return null;
    case 'daily':
      return `${s.minute} ${s.hour} * * *`;
    case 'weekdays':
      return `${s.minute} ${s.hour} * * 1-5`;
    case 'weekly':
      return `${s.minute} ${s.hour} * * ${s.day}`;
    case 'hourly':
      return `${s.minute} * * * *`;
    case 'custom':
      // 빈 칸은 스케줄 없음으로 저장한다. 검사 오류로 남기지 않는다.
      return s.cron.trim() ? s.cron : null;
  }
}
