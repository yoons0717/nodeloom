#!/bin/sh
# 운영 폴더에서 새 커밋을 받아 다시 빌드하고 다시 띄운다.
# 운영 폴더(~/nodeloom-prod)에서 Node 24.15 이상으로 실행한다. launchd 에이전트 com.nodeloom.prod.{api,web}가 있어야 한다.
set -eu
cd "$(dirname "$0")/.."

# launchd가 띄우는 Node와 같은 버전으로 빌드해야 한다.
node -e 'const [a, b] = process.versions.node.split(".").map(Number);
if (a < 24 || (a === 24 && b < 15)) {
  console.error(`Node 24.15 이상이 필요합니다(지금 ${process.version})`);
  process.exit(1);
}'

git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build

uid=$(id -u)
launchctl kickstart -k "gui/$uid/com.nodeloom.prod.api"
launchctl kickstart -k "gui/$uid/com.nodeloom.prod.web"

for _ in $(seq 1 30); do
  if curl -fs -o /dev/null localhost:4100/health &&
    curl -fs -o /dev/null localhost:3100/login; then
    echo "다시 띄웠습니다: $(git log --oneline -1)"
    exit 0
  fi
  sleep 2
done
echo "60초 안에 응답이 없습니다. logs/api.log, logs/web.log를 확인하세요" >&2
exit 1
