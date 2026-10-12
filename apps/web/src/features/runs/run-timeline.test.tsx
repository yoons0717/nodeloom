// @vitest-environment jsdom
import { GRAPH_SCHEMA_VERSION, type GraphNode } from '@nodeloom/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunTimeline } from './run-timeline';

afterEach(cleanup);

const node = (id: string, title: string): GraphNode => ({
  id,
  key: id,
  type: 'transform',
  title,
  position: { x: 0, y: 0 },
  config: {},
});
const at = (s: number) =>
  new Date(Date.UTC(2026, 9, 11, 0, 0, s)).toISOString();

describe('RunTimeline', () => {
  it('시작한 순서대로 보여 주고, 전체의 절반을 넘긴 노드에만 경고 막대를 붙인다', () => {
    const { container } = render(
      <RunTimeline
        graph={{
          schemaVersion: GRAPH_SCHEMA_VERSION,
          nodes: [
            node('b', '느린 노드'),
            node('a', '첫 노드'),
            node('c', '건너뛴 노드'),
          ],
          edges: [],
        }}
        nodes={[
          {
            nodeId: 'b',
            status: 'SUCCESS',
            attempt: 1,
            port: null,
            startedAt: at(1),
            finishedAt: at(4),
          },
          {
            nodeId: 'a',
            status: 'SUCCESS',
            attempt: 1,
            port: null,
            startedAt: at(0),
            finishedAt: at(1),
          },
          {
            nodeId: 'c',
            status: 'SKIPPED',
            attempt: 1,
            port: null,
            startedAt: at(5),
            finishedAt: at(5),
          },
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole('button').map((b) => b.textContent);
    expect(rows).toEqual([
      expect.stringContaining('첫 노드'),
      expect.stringContaining('느린 노드'),
      expect.stringContaining('건너뜀'),
    ]);
    // 느린 노드(3초 / 전체 4초)에만 막대
    expect(container.querySelectorAll('.bg-warning')).toHaveLength(1);
    expect(rows[1]).toContain('3.0s');
  });
});
