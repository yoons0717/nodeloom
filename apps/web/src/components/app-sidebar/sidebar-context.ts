'use client';

import { createContext, useContext } from 'react';

export type SidebarState = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  openMobile: () => void;
  // md – lg에서 펼친 사이드바를 본문 위에 겹쳐 연다(RESPONSIVE 4-1). search면 찾기 칸에 포커스한다.
  openOverlay: (search?: boolean) => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

// 틀(SidebarShell) 밖에서는 null. 사이드바는 그때 펼친 모양으로 그린다(테스트 등).
export function useSidebarState() {
  return useContext(SidebarContext);
}
