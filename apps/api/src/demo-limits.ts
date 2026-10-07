// 데모 서버의 상한(DECISIONS 8-3, M3 작은 결정 ②). 자동 초기화가 없어서(6-5) 쌓이는 양을 막는 유일한 방어선이다.
export const DEMO_LIMITS = {
  workflows: 20,
  nodesPerGraph: 100,
  bodySize: '256kb',
  requestsPerMinute: 120,
} as const;

// 관리자 서버의 요청 크기 상한. express 기본값(100kb)은 큰 그래프에 모자란다.
export const ADMIN_BODY_SIZE = '1mb';
