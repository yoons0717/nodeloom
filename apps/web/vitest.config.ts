import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 화면 코드가 쓰는 `@/` 경로를 tsconfig의 paths에서 읽는다.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // CI는 lint·타입 검사·빌드와 함께 돌아 느리다. 로컬 0.1초인 화면 테스트가 CI에서 5초를 넘은 적이 있다.
    testTimeout: 20_000,
  },
});
