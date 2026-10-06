import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 화면 코드가 쓰는 `@/` 경로를 tsconfig의 paths에서 읽는다.
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
