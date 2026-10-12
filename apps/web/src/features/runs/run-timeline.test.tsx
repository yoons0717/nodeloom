// @vitest-environment jsdom
import { GRAPH_SCHEMA_VERSION, type GraphNode } from '@nodeloom/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firstFailedNodeId, RunTimeline } from './run-timeline';

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
    const rows = screen
      .getAllByRole('button', { pressed: false })
      .map((b) => b.textContent);
    expect(rows).toEqual([
      expect.stringContaining('첫 노드'),
      expect.stringContaining('느린 노드'),
      expect.stringContaining('건너뜀'),
    ]);
    // 모든 실행 행에 비율 막대, 느린 노드(3초 / 전체 4초)만 경고색
    expect(container.querySelectorAll('.bg-warning')).toHaveLength(1);
    expect(container.querySelectorAll('.bg-accent')).toHaveLength(1);
    expect(rows[1]).toContain('3.0s');
  });

  it('노드가 8개를 넘으면 처음부터 접어 두고, 머리글을 누르면 펼친다', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      node(`n${i}`, `노드 ${i}`),
    );
    render(
      <RunTimeline
        graph={{ schemaVersion: GRAPH_SCHEMA_VERSION, nodes: many, edges: [] }}
        nodes={many.map((n, i) => ({
          nodeId: n.id,
          status: 'SUCCESS' as const,
          attempt: 1,
          port: null,
          startedAt: at(i),
          finishedAt: at(i + 1),
        }))}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: /실행 순서/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('노드 0')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText('노드 0')).toBeTruthy();
  });
});

describe('firstFailedNodeId', () => {
  it('가장 먼저 실패한 노드를 고르고, 실패가 없으면 null', () => {
    const r = (nodeId: string, status: 'SUCCESS' | 'FAILED', s: number) => ({
      nodeId,
      status,
      attempt: 1,
      port: null,
      startedAt: at(s),
      finishedAt: at(s + 1),
    });
    expect(
      firstFailedNodeId([
        r('late', 'FAILED', 5),
        r('early', 'FAILED', 2),
        r('ok', 'SUCCESS', 0),
      ]),
    ).toBe('early');
    expect(firstFailedNodeId([r('ok', 'SUCCESS', 0)])).toBeNull();
  });
});
