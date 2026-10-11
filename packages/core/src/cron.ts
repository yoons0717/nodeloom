import { CronExpressionParser } from 'cron-parser';

// pg-boss와 같은 cron-parser로 해석해 에디터와 스케줄러의 판단을 맞춘다.
// 스케줄러는 분 단위로 돌기 때문에 초가 들어간 6자리는 받지 않는다.
export function isValidCron(cron: string): boolean {
  if (cron.trim().split(/\s+/).length !== 5) return false;
  try {
    CronExpressionParser.parse(cron);
    return true;
  } catch {
    return false;
  }
}

export function nextCronRuns(
  cron: string,
  tz: string,
  count: number,
  from: Date = new Date(),
): Date[] {
  const expr = CronExpressionParser.parse(cron, { tz, currentDate: from });
  return expr.take(count).map((d) => d.toDate());
}
