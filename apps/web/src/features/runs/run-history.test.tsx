// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RunHistory } from './run-history';

afterEach(cleanup);

const at = new Date().toISOString();
const run = {
  kind: 'MANUAL' as const,
  error: null,
  createdAt: at,
  startedAt: null,
  finishedAt: null,
  workflow: { id: 'w1', name: '디스코드' },
};

describe('RunHistory', () => {
  it('상태를 점 + 글자로 보여 주고, 대기 중은 오른쪽 열에 다시 쓰지 않는다', () => {
    render(
      <RunHistory
        runs={[{ ...run, id: 'r1', status: 'PENDING' }]}
        filter="all"
        basePath="/runs"
      />,
    );
    const row = screen.getByRole('link', { name: /디스코드/ });
    expect(row.getAttribute('href')).toBe('/w/w1/runs/r1');
    expect(within(row).getAllByText('대기 중')).toHaveLength(1);
  });
});
