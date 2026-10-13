'use client';

import { createContext, useContext } from 'react';

export type SidebarState = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  openMobile: () => void;
  // md – lg에서 펼친 사이드바를 본문 위에 겹쳐 연다(RESPONSIVE 4-1). search면 찾기 칸에 포커스한다.
  // opener: 닫힌 뒤 포커스를 돌려줄 버튼. 터치(iPad Safari)에서는 눌러도 버튼에 포커스가 가지 않아 직접 넘긴다.
  openOverlay: (options?: { search?: boolean; opener?: HTMLElement }) => void;
};

export const SidebarContext = createContext<SidebarState | null>(null);

// 틀(SidebarShell) 밖에서는 null. 사이드바는 그때 펼친 모양으로 그린다(테스트 등).
export function useSidebarState() {
  return useContext(SidebarContext);
}
