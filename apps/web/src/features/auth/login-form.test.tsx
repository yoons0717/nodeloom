// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submit(password: string) {
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
}

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

  it('비밀번호를 비우고 로그인하면 요청 없이 칸 아래에 알린다', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    render(<LoginForm />);
    submit('');
    expect(screen.getByRole('alert').textContent).toContain(
      '비밀번호를 입력하세요',
    );
    expect(screen.getByLabelText('비밀번호').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('로그인에 실패하면 서버가 준 사유를 보여 주고 다시 누를 수 있다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { message: '비밀번호가 올바르지 않습니다' },
            { status: 401 },
          ),
        ),
      ),
    );
    render(<LoginForm />);
    submit('wrong');
    expect((await screen.findByRole('alert')).textContent).toContain(
      '비밀번호가 올바르지 않습니다',
    );
    const input = screen.getByLabelText('비밀번호');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('login-error');
    // "로그인 중"에 머물지 않는다.
    expect(
      screen.getByRole('button', { name: '로그인' }).hasAttribute('disabled'),
    ).toBe(false);
  });
});
