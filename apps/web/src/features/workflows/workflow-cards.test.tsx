// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runStatus, WorkflowCards } from './workflow-cards';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const at = '2026-10-17T03:03:00.000Z'; // 서울 12:03

describe('runStatus', () => {
  it('실패는 끝난 시각과, 24시간 안에 두 번 이상이면 횟수를 붙인다', () => {
    expect(
      runStatus({
        lastRun: { status: 'FAILED', finishedAt: at },
        failedLast24h: 2,
      }),
    ).toEqual({ tone: 'fail', text: '실패 · 10월 17일 12:03 · 24시간 2회' });
    expect(
      runStatus({
        lastRun: { status: 'FAILED', finishedAt: at },
        failedLast24h: 1,
      }).text,
    ).toBe('실패 · 10월 17일 12:03');
  });

  it('성공이어도 24시간 안의 실패는 회색 글자로 덧붙인다', () => {
    expect(
      runStatus({
        lastRun: { status: 'SUCCESS', finishedAt: at },
        failedLast24h: 1,
      }),
    ).toEqual({ tone: 'ok', text: '성공 · 10월 17일 12:03 · 24시간 1회 실패' });
  });

  it('실행 중·대기 중·실행 안 함', () => {
    const base = { finishedAt: null };
    expect(
      runStatus({ lastRun: { ...base, status: 'RUNNING' }, failedLast24h: 0 })
        .text,
    ).toBe('실행 중');
    expect(
      runStatus({ lastRun: { ...base, status: 'PENDING' }, failedLast24h: 0 })
        .text,
    ).toBe('대기 중');
    expect(runStatus({ lastRun: null, failedLast24h: 0 })).toEqual({
      tone: 'none',
      text: '아직 실행 안 함',
    });
  });
});

describe('WorkflowCards', () => {
  const card = {
    id: 'w1',
    name: '디스코드',
    nodeCount: 5,
    cron: null,
    lastRun: { status: 'FAILED' as const, finishedAt: at },
    failedLast24h: 1,
    updatedAt: at,
  };

  it('스케줄은 다음 실행을 붙이고, 데모에서는 빼고, 잘못되면 오류로 보여 준다', () => {
    const daily = { ...card, cron: '0 7 * * *' };
    const view = (cron: string, demo: boolean) =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <WorkflowCards initial={[{ ...daily, cron }]} demo={demo} />
        </QueryClientProvider>,
      );
    view('0 7 * * *', false);
    expect(screen.getByText(/· 다음/)).toBeTruthy();
    cleanup();
    view('0 7 * * *', true);
    expect(screen.getByText('매일 07:00')).toBeTruthy();
    expect(screen.queryByText(/· 다음/)).toBeNull();
    cleanup();
    view('nope', false);
    expect(screen.getByText('스케줄 오류')).toBeTruthy();
  });
});
