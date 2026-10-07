import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { z } from 'zod';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// 서버 컴포넌트에서 NestJS를 직접 부른다. 브라우저 쿠키를 그대로 실어 보내야 인증된다(DECISIONS 6-4).
// 실제 인증 검사는 NestJS Guard가 하고, 여기서는 결과에 따라 이동만 한다(M3 작은 결정 ⑥).
export async function serverApi<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.output<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  // 서버 응답도 밖에서 들어온 값이라 경계에서 검사한다(CONVENTIONS 3).
  return schema.parse(await res.json());
}

// 로그인 여부만 확인한다. 로그인 화면처럼 401이어도 이동하면 안 되는 곳에서 쓴다.
export async function isSignedIn(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  return res.ok;
}
