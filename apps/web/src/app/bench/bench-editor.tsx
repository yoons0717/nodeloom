'use client';

import { useEffect, useState } from 'react';
import { createBenchGraph, installBenchApi } from '@/features/editor/bench';
import { Editor } from '@/features/editor/editor';

export function BenchEditor({ count }: { count: number }) {
  const [graph] = useState(() => createBenchGraph(count));
  useEffect(installBenchApi, []);
  // 사이드바 틀 밖이라 화면 높이를 직접 준다.
  return (
    <div className="flex h-dvh flex-col">
      <Editor initial={graph} bench />
    </div>
  );
}
