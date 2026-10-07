# Nodeloom

노드를 이어 반복 작업을 자동화하는 워크플로우 도구 (Node-based workflow automation)

> 계획과 결정 기록은 [`docs/`](docs)에 있습니다.

## 실행

필요한 것: Node 24(`.nvmrc`), Corepack(pnpm 12), Docker

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm admin:hash        # 터미널 앱에서 실행. 출력된 한 줄을 .env의 ADMIN_PASSWORD_HASH 자리에 붙여 넣기
openssl rand -hex 32   # 출력값을 .env의 JWT_SECRET에 넣기
docker compose up -d
pnpm db:migrate        # DB 테이블 만들기(마이그레이션 적용)
pnpm dev
```

- 공개 데모처럼 로그인 없이 쓰려면 `.env`에 `DEMO_MODE=true`를 넣는다. 이때는 해시와 `JWT_SECRET`이 없어도 된다.

- 웹: http://localhost:3000
- 서버 상태: http://localhost:3000/api/health (Next가 NestJS로 중계)

## 명령

| 명령                                          | 내용                                       |
| --------------------------------------------- | ------------------------------------------ |
| `pnpm dev`                                    | web, api, core를 함께 실행                 |
| `pnpm db:migrate`                             | DB 마이그레이션 적용                       |
| `pnpm admin:hash`                             | 관리자 비밀번호 해시 만들기                |
| `pnpm test`                                   | 전체 테스트(api 통합 테스트는 Docker 필요) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | 검사와 빌드                                |

Colima를 쓴다면 테스트 전에 다음 환경 변수가 필요합니다.

```bash
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
```

## 문서

- [프로젝트 계획](docs/PROJECT_PLAN.md)
- [결정 기록(ADR)](docs/DECISIONS.md)
- [백로그](docs/BACKLOG.md)
- [코드 컨벤션](docs/CONVENTIONS.md)
- [디자인 토큰](docs/DESIGN.md)
- [마일스톤별 계획](docs/milestones)
