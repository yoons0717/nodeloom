'use client';

import { useEffect, useState } from 'react';
import { formatDuration } from './format';

// 실행 중인 행의 경과 시간. 1초마다 다시 그린다.
// 서버에서 그린 값과 브라우저 시각이 달라 처음 한 번은 hydration 경고를 끈다.
export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{formatDuration(since, now)}</span>;
}
