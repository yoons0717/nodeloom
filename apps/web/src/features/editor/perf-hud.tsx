'use client';

import { Panel } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useEditorStore } from './store-context';

// 벤치 모드에서 캔버스 구석에 보이는 성능 표시. 1초마다 갱신한다.
export function PerfHud() {
  const total = useEditorStore((s) => s.graph.nodes.length);
  const [rendered, setRendered] = useState(0);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let raf = requestAnimationFrame(function tick() {
      frames++;
      raf = requestAnimationFrame(tick);
    });
    const timer = setInterval(() => {
      setFps(frames);
      frames = 0;
      // React Flow가 실제로 DOM에 그린 노드 수(화면 밖 노드를 건너뛰면 전체보다 적다).
      setRendered(document.querySelectorAll('.react-flow__node').length);
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  return (
    <Panel
      position="top-right"
      className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-caption text-muted-foreground"
    >
      <div>노드 {total}</div>
      <div>그려진 노드 {rendered}</div>
      <div>FPS {fps}</div>
    </Panel>
  );
}
