import {
  GRAPH_SCHEMA_VERSION,
  type Graph,
  type GraphEdge,
  type GraphNode,
} from '@nodeloom/core';
import type { ProfilerOnRenderCallback } from 'react';

// 벤치 모드(/bench)에서만 측정값을 모은다. 측정 순서는 Playwright가 window.__bench로 정한다.
export type BenchResult = {
  nodeRenders: number;
  commits: number;
  commitMs: number;
  frames: number[];
};

const stats: BenchResult & { recording: boolean } = {
  recording: false,
  nodeRenders: 0,
  commits: 0,
  commitMs: 0,
  frames: [],
};

// 노드 카드 하나가 다시 그려질 때마다 불린다.
export const onNodeRender: ProfilerOnRenderCallback = () => {
  if (stats.recording) stats.nodeRenders++;
};

// 에디터 전체가 화면에 반영(commit)될 때마다 불린다. actualDuration은 이번 반영에 쓴 렌더 시간.
export const onEditorRender: ProfilerOnRenderCallback = (
  _id,
  _phase,
  actualDuration,
) => {
  if (!stats.recording) return;
  stats.commits++;
  stats.commitMs += actualDuration;
};

// 프레임 사이 간격을 잰다. 16.7ms(60fps)를 넘으면 사용자가 끊김을 느낄 수 있다.
function measureFrames() {
  let last = performance.now();
  const tick = (now: number) => {
    if (!stats.recording) return;
    stats.frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function installBenchApi() {
  Object.assign(window, {
    __bench: {
      start() {
        Object.assign(stats, {
          recording: true,
          nodeRenders: 0,
          commits: 0,
          commitMs: 0,
          frames: [],
        });
        measureFrames();
      },
      stop(): BenchResult {
        stats.recording = false;
        const { nodeRenders, commits, commitMs, frames } = stats;
        return { nodeRenders, commits, commitMs, frames };
      },
    },
  });
}

// 벤치용 그래프: Trigger 하나에 나머지 노드를 격자로 놓고 앞 노드와 잇는다. 설정을 채워 오류 배지가 없게 한다.
export function createBenchGraph(count: number): Graph {
  const cols = Math.ceil(Math.sqrt(count));
  const nodes: GraphNode[] = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    key: i === 0 ? 'trigger_1' : `transform_${i}`,
    type: i === 0 ? 'trigger' : 'transform',
    title: i === 0 ? 'Trigger' : `노드 ${i}`,
    position: { x: (i % cols) * 224, y: Math.floor(i / cols) * 128 },
    config:
      i === 0
        ? {}
        : {
            expression: `$nodes.${i === 1 ? 'trigger_1' : `transform_${i - 1}`}`,
          },
  }));
  const edges: GraphEdge[] = nodes.slice(1).map((n, i) => ({
    id: `e${i}`,
    from: { node: nodes[i]!.id, port: 'out' },
    to: { node: n.id, port: 'in' },
  }));
  return { schemaVersion: GRAPH_SCHEMA_VERSION, nodes, edges };
}
