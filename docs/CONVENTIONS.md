# 코드 컨벤션

> **상태: 확정 (2026-10-06).** 도구가 자동으로 지키는 것(포맷, lint)은 여기 적지 않는다. 사람이 판단해야 하는 규칙만 적는다.

## 자동으로 지켜지는 것

| 항목 | 도구 | 명령 |
|---|---|---|
| 포맷(따옴표, 줄바꿈, 들여쓰기) | Prettier(`.prettierrc.json`) | `pnpm format` |
| 문법·위험 패턴(빠뜨린 `await` 등) | ESLint(`eslint.config.mjs`, 타입 정보 규칙 포함) | `pnpm lint` |
| 타입 | TypeScript strict, `noUncheckedIndexedAccess` | `pnpm typecheck` |

## 1. 파일과 폴더

| 규칙 | 예 |
|---|---|
| 파일 이름은 소문자 kebab-case | `node-palette.tsx`, `graph.ts` |
| NestJS는 역할 접미사를 붙인다 | `health.controller.ts`, `prisma.service.ts`, `runs.module.ts` |
| Next.js 라우트 파일은 프레임워크 규칙을 따른다 | `page.tsx`, `layout.tsx` |
| 한 파일에는 한 가지 관심사만 둔다. 300줄을 넘으면 나눌지 검토 | `topo.ts`는 위상 정렬만 |
| 공용 규칙은 `packages/core`, 화면 전용은 `apps/web`, 서버 전용은 `apps/api`(9-2) | Undo 커맨드는 `apps/web` |
| 생성 파일은 `generated/`에 두고 커밋하지 않는다 | Prisma 클라이언트 |

## 2. 이름

| 대상 | 규칙 | 예 |
|---|---|---|
| 변수, 함수 | camelCase, 함수는 동사로 시작 | `validateGraph`, `buildInput` |
| 타입 | PascalCase. `I` 접두사를 붙이지 않는다 | `GraphNode`, `Issue` |
| 상수 | 모듈 수준의 고정값은 UPPER_SNAKE_CASE | `GRAPH_SCHEMA_VERSION`, `NODE_SPECS` |
| zod 스키마 | camelCase + `Schema` | `graphSchema` |
| 불리언 | `is`, `has`, `can`으로 시작하거나 의미가 분명한 형용사 | `isOutput`, `canConnect` |
| 약어 | 일반 단어처럼 쓴다 | `httpConfig`, `apiUrl` |

## 3. TypeScript

- 내보내기는 이름 있는 export만 쓴다. Next.js의 `page.tsx`, `layout.tsx`처럼 프레임워크가 default export를 요구하는 곳만 예외
- 상대 경로 import에는 `.js` 확장자를 붙인다(ESM, F-1)
- 다른 패키지 코드는 `@nodeloom/core`처럼 패키지 이름으로 가져온다. 다른 앱의 파일을 상대 경로로 가져오지 않는다
- `any`를 쓰지 않는다. 모르는 값은 `unknown`으로 받고 zod로 좁힌다
- 외부에서 들어온 데이터(HTTP 요청, DB의 JSON 컬럼, 환경 변수)는 경계에서 zod로 검증한다(6-2)
- `!`(non-null 단언)는 바로 앞에서 존재가 보장된 경우에만 쓴다

## 4. 주석과 메시지

| 항목 | 규칙 |
|---|---|
| 코드 주석 | 한국어. **무엇**이 아니라 **왜**를 쓴다. 코드만 봐서 알 수 있는 내용은 쓰지 않는다 |
| 결정 근거 | 설계 결정을 따르는 코드는 주석에 결정 번호를 남긴다(예: `DECISIONS 7-2`) |
| 사용자에게 보이는 메시지 | 한국어. 무엇이 잘못됐고 어떻게 고치는지 쓴다 |
| 로그 메시지 | 영어 |
| 식별자 | 영어 |

## 5. 테스트

### 위치와 이름
| 규칙 | 예 |
|---|---|
| 테스트는 대상 파일 옆에 둔다 | `topo.ts` ↔ `topo.test.ts` |
| 테스트 파일 접미사는 `.test.ts`로 통일한다. Nest 생성 도구가 만든 `.spec.ts`는 이름을 바꾼다 | `health.controller.test.ts` |
| 실제 DB나 컨테이너를 쓰는 통합 테스트도 같은 접미사를 쓰고, 파일 첫 주석에 무엇을 띄우는지 적는다 | `health.controller.test.ts` |
| 테스트용 예시 데이터와 도우미는 `*.test-util.ts`에 두고 빌드에서 제외한다 | `fixtures.test-util.ts` |

### 구조
- `describe`는 테스트 대상(함수나 엔드포인트), `it`은 규칙 하나
- `it` 하나는 한 가지 동작만 확인한다
- `describe`에는 대상 이름(함수, 엔드포인트)을 그대로, `it`에는 **한국어로 규칙을 한 문장으로** 쓴다. 예: `it('부모가 모두 건너뛰어졌으면 합류 노드도 건너뛴다')`
- 성공 케이스와 실패 케이스를 함께 둔다. 실패 케이스가 없는 규칙은 테스트가 없는 것으로 본다
- 검증 결과는 메시지 문장이 아니라 **코드(`code`)로** 판정한다. 메시지 문구를 바꿔도 테스트가 깨지지 않게
- 테스트끼리 상태를 공유하지 않는다. 예시 그래프는 매번 새로 만든다(`rainFlow()`)

### 무엇을 어떤 테스트로
| 대상 | 테스트 | 근거 |
|---|---|---|
| core 규칙 | 단위 테스트(가장 많이) | 10-2 |
| DB 제약, 트랜잭션, 실행 엔진 | 실제 Postgres 통합 테스트(Testcontainers) | 10-2 |
| 커맨드 스택, 화면 로직 | 단위 테스트, 필요한 컴포넌트만 RTL | 10-2 |
| 핵심 사용자 흐름 | e2e(Playwright) 3~5개 | 10-2 |
| mock은 외부 경계(외부 HTTP)에만 쓴다. DB는 mock하지 않는다 | — | 10-2 |

### 경계값과 걸러 내는 값
- 범위는 거부되는 값과 통과하는 끝값을 함께 확인한다. 예: 1~30이면 0·31 거부, 1·30 통과
- 걸러져야 하는 값은 일부러 넣어 두고 빠지는지 확인한다. 처음부터 넣지 않으면 걸러 내는 코드를 지워도 테스트가 통과한다
- 테스트 예시 데이터가 우연히 같은 값을 쓰지 않게 한다. 예: 노드 id와 참조 키가 늘 같으면 키 대신 id를 써도 테스트가 통과한다

### 뮤테이션 테스트 (core)
- core 로직의 테스트를 쓰거나 고치면 `pnpm --filter @nodeloom/core mutation`으로 빈틈을 확인하고, 살아남은 경계값·분기를 메운다. 오류 문구를 바꾼 뮤턴트와 결과가 같은 변형은 넘긴다
- 점수는 목표가 아니라 빈틈을 찾는 신호다
- 원본 파일을 바꿔 가며 실행하므로 dev 서버를 끄고 돌린다. 끝나면 `git status`로 `src`가 그대로인지 확인한다

## 6. 커밋

| 항목 | 규칙 |
|---|---|
| 형식 | `종류: 요약` (한국어 요약). 종류는 `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci` |
| 단위 | 마일스톤 안에서 의미 있는 단위로 나눈다. lint, 타입 체크, 테스트가 통과한 상태로만 커밋 |
