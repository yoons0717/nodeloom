// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(cleanup);

describe('LoginForm', () => {
  it('보기 버튼으로 비밀번호를 보였다 숨긴다', () => {
    render(<LoginForm />);
    const input = screen.getByLabelText('비밀번호');
    const toggle = screen.getByRole('button', { name: '보기' });
    expect(input.getAttribute('type')).toBe('password');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(input.getAttribute('type')).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    expect(input.getAttribute('type')).toBe('password');
  });
});
