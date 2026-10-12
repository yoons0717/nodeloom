'use client';

import { createContext, useContext } from 'react';

export type SidebarState = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  openMobile: () => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

// 틀(SidebarShell) 밖에서는 null. 사이드바는 그때 펼친 모양으로 그린다(테스트 등).
export function useSidebarState() {
  return useContext(SidebarContext);
}
