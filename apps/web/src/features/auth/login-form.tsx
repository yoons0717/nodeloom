'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/client-api';

const loginSchema = z.object({
  password: z.string().min(1, { error: '비밀번호를 입력하세요' }),
});

// 제출형 폼은 기본 <form>과 zod로 처리한다(DECISIONS 4-4).
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = loginSchema.safeParse(
      Object.fromEntries(new FormData(e.currentTarget)),
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await clientApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold">Nodeloom</h1>
        <p className="text-xs text-muted-foreground">
          관리자 비밀번호로 로그인하세요
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs text-muted-foreground">
          비밀번호
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
        {error && (
          <p
            id="login-error"
            role="alert"
            className="text-xs text-destructive-text"
          >
            {error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? '로그인 중…' : '로그인'}
      </Button>
    </form>
  );
}
