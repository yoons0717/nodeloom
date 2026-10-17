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

  it('실패는 빨간 글자로, 모든 실행에서는 워크플로우 이름을 붙인다', () => {
    render(
      <RunHistory
        runs={[
          {
            ...run,
            id: 'r2',
            status: 'FAILED',
            error: { message: '날씨 조회: 504' },
          },
        ]}
        filter="all"
        basePath="/runs"
      />,
    );
    const row = screen.getByRole('link', { name: /디스코드/ });
    expect(within(row).getByText('실패').className).toContain(
      'text-danger-text',
    );
    expect(screen.getByText('디스코드')).toBeTruthy();
    expect(screen.getByText('날씨 조회: 504')).toBeTruthy();
  });
});
