import { useSyncExternalStore } from 'react';

// 폭과 입력 방식 질의(RESPONSIVE 3장). 처음 그림은 CSS로 나누고, 여기 값은 누를 때나 마운트 뒤에만 쓴다.
// 테스트(jsdom)처럼 matchMedia가 없으면 fallback을 돌려준다.
function matches(query: string, fallback: boolean) {
  return typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
    ? fallback
    : window.matchMedia(query).matches;
}

// xl(1280px) 이상: 에디터 3열, 사이드바 저장값을 따른다.
export function isXl() {
  return matches('(min-width: 1280px)', true);
}

const FINE = '(pointer: fine)';

// 마우스처럼 정밀한 포인터인지. HTML 끌어다 놓기는 이때만 켠다(RESPONSIVE R9). 서버 그림은 false.
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
