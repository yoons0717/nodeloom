// 서버와 브라우저가 같은 시간대로 시각을 보여 주도록 APP_TIMEZONE을 쓴다(DECISIONS 3-5, hydration 불일치 방지).
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
