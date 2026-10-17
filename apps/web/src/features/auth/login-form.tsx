'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
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
  const [showPassword, setShowPassword] = useState(false);

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
        <h1 className="text-xl font-bold">Nodeloom</h1>
        <p className="text-sm text-muted-foreground">
          관리자 비밀번호로 로그인하세요
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-medium text-label">
          비밀번호
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            className="pr-16"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
          />
          {/* 이름은 "보기"로 두고 켜짐 여부는 aria-pressed로 알린다. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showPassword}
            aria-controls="password"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setShowPassword(!showPassword)}
          >
            보기
          </Button>
        </div>
        {error && (
          <InlineError
            id="login-error"
            role="alert"
            className="text-xs"
            message={error}
          />
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? '로그인 중' : '로그인'}
      </Button>
    </form>
  );
}
