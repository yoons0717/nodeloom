'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

// 서버 상태(저장 요청 등)는 TanStack Query로 다룬다. 요청마다 섞이지 않도록 컴포넌트 안에서 만든다.
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
