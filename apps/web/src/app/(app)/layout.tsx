import { cookies } from 'next/headers';
import { COLLAPSED_KEY } from '@/components/app-sidebar/sidebar-constants';
import { SidebarShell } from '@/components/app-sidebar/sidebar-shell';
import { meSchema, workflowListSchema } from '@/features/workflows/schemas';
import { serverApi } from '@/lib/server-api';

// 목록·에디터·실행 기록·실행 상세가 함께 쓰는 틀(M6 6-g). 로그인·벤치는 이 묶음 밖이라 사이드바가 없다.
// 로그인하지 않았으면 serverApi가 /login으로 보낸다.
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const [me, workflows, cookieStore] = await Promise.all([
    serverApi('/auth/me', meSchema),
    serverApi('/workflows', workflowListSchema),
    cookies(),
  ]);
  // 접힘을 고른 적이 있으면 쿠키에 있다. 서버에서 읽어 처음 그릴 때부터 맞는 폭으로 그린다.
  const stored = cookieStore.get(COLLAPSED_KEY)?.value;
  return (
    <SidebarShell
      role={me.role}
      initialWorkflows={workflows}
      storedCollapsed={stored === undefined ? null : stored === '1'}
    >
      {children}
    </SidebarShell>
  );
}
