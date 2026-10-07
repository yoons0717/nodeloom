'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await clientApi('/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }
  return (
    <Button variant="ghost" onClick={() => void logout()}>
      로그아웃
    </Button>
  );
}
