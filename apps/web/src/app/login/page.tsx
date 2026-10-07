import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/auth/login-form';
import { isSignedIn } from '@/lib/server-api';

export const metadata: Metadata = { title: '로그인 · Nodeloom' };

export default async function LoginPage() {
  // 이미 로그인했거나 데모 서버(로그인 없이 demo 사용자)면 목록으로 보낸다.
  if (await isSignedIn()) redirect('/');
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <LoginForm />
    </main>
  );
}
