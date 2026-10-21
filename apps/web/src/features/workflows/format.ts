// 서버와 브라우저가 같은 시간대로 시각을 보여 주도록 APP_TIMEZONE을 쓴다(hydration 불일치 방지).
export const TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Seoul';

const formatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  // 오전·오후 표기가 런타임의 국제화 데이터마다 달라서(예: "PM") 24시간으로 쓴다.
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatDateTime(iso: string) {
  return formatter.format(new Date(iso));
}

// 실행을 부르는 이름("10월 11일 07:00"). 실행 기록에는 순번이 없어서 시각으로 부른다.
const shortFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIMEZONE,
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatRunTime(iso: string) {
  return shortFormatter.format(new Date(iso));
}

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// 실행 기록 행의 시각(HH:mm). 날짜는 묶음 머리글에 있다.
export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// APP_TIMEZONE 기준 날짜(YYYY-MM-DD). 날짜별로 묶을 때 쓴다.
export function dayKey(iso: string | Date) {
  return dayKeyFormatter.format(new Date(iso));
}
