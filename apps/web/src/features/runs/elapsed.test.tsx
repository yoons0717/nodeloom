// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Elapsed } from './elapsed';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Elapsed', () => {
  it('시작한 뒤 지난 시간을 1초마다 다시 보여 준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T00:00:05Z'));
    render(<Elapsed since="2026-10-11T00:00:00Z" />);
    expect(screen.getByText('5.0초')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('7.0초')).toBeTruthy();
  });
});
