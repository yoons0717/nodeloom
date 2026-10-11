import type { GraphNode, NodeType } from '@nodeloom/core';
import { describe, expect, it } from 'vitest';
import { summarizeNode } from './node-meta';

const node = (type: NodeType, config: Record<string, unknown>): GraphNode => ({
  id: 'n',
  key: 'n',
  type,
  title: '',
  position: { x: 0, y: 0 },
  config,
});

describe('summarizeNode', () => {
  it('종류마다 카드 셋째 줄에 보여 줄 설정 요약을 만든다', () => {
    expect(summarizeNode(node('trigger', { cron: '0 7 * * *' }))).toBe(
      '매일 07:00',
    );
    expect(summarizeNode(node('trigger', {}))).toBe('직접 실행');
    expect(
      summarizeNode(
        node('http', { method: 'POST', url: 'https://api.kr/v1/log?x=1' }),
      ),
    ).toBe('POST /v1/log?x=1');
    // 해석할 수 없는 주소(템플릿 등)는 적은 그대로
    expect(summarizeNode(node('http', { url: '{{ $secrets.HOOK }}' }))).toBe(
      'GET {{ $secrets.HOOK }}',
    );
    expect(
      summarizeNode(node('transform', { expression: '{\n  "a":   1\n}' })),
    ).toBe('{ "a": 1 }');
  });
});
