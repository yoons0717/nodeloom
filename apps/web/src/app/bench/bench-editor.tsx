'use client';

import { useEffect, useState } from 'react';
import { createBenchGraph, installBenchApi } from '@/features/editor/bench';
import { Editor } from '@/features/editor/editor';

export function BenchEditor({ count }: { count: number }) {
  const [graph] = useState(() => createBenchGraph(count));
  useEffect(installBenchApi, []);
  return <Editor initial={graph} bench />;
}
