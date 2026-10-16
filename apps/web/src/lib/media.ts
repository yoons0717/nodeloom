import { useSyncExternalStore } from 'react';

// 폭 단계(DESIGN.md "반응형"). Tailwind md · lg · xl과 같은 값이다.
const WIDTH = { md: 768, lg: 1024, xl: 1280 } as const;
type Width = keyof typeof WIDTH;

export const minWidth = (step: Width) => `(min-width: ${WIDTH[step]}px)`;

// 폭과 입력 방식 질의(DESIGN.md 반응형). 처음 그림은 CSS로 나누고, 여기 값은 누를 때나 마운트 뒤에만 쓴다.
// 테스트(jsdom)처럼 matchMedia가 없으면 fallback을 돌려준다.
function matches(query: string, fallback: boolean) {
  return typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
    ? fallback
    : window.matchMedia(query).matches;
}

// 폭이 그 단계 이상인지. matchMedia가 없으면 넓은 화면으로 본다.
export function isAtLeast(step: Width) {
  return matches(minWidth(step), true);
}

const FINE = '(pointer: fine)';

// 마우스처럼 정밀한 포인터인지. HTML 끌어다 놓기는 이때만 켠다(DESIGN.md 반응형). 서버 그림은 false.
export function usePointerFine() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(FINE);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => matches(FINE, true),
    () => false,
  );
}
