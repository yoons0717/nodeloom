# 디자인 토큰

> 방향: **어두운 작업실형**(디자인 시안 B). 지금은 어두운 테마만 쓴다. 색은 반드시 아래 토큰(CSS 변수)으로만 쓰고 색 값을 코드에 직접 적지 않는다. 밝은 테마는 나중에 토큰 값만 한 벌 더 정의하면 된다(BACKLOG). 실제 정의는 `apps/web/src/app/globals.css`에 있다. 2026-10-11 디자인 리뷰로 토큰을 기본값 → 의미 → 부품 세 단으로 나눴다(M6).

## 원칙

- 청록(`--accent`)은 **선택·포커스·주요 버튼·실행 중·지나간 연결선**에만 쓴다. 노드 종류 표시, 성공, 정보 글자에는 쓰지 않는다.
- 상태는 항상 글리프와 함께 보여 준다: ✓ 성공, ▲ 경고, ! 오류, ● 실행 중, – 건너뜀. 색에만 기대지 않는다.
- `/10` 같은 투명도 색을 클래스에서 만들지 않는다. 옅은 색이 필요하면 `-soft` 토큰을 쓴다.
- shadcn 부품이 쓰는 이름(`--primary`, `--input`, `--ring` 등)은 아래 의미 토큰을 가리키는 별칭으로만 둔다.

## 색

### 표면과 테두리

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--bg` | `#0E1116` | 페이지와 캔버스 바탕, 입력 칸 안쪽 |
| `--surface` | `#151A21` | 상단 바, 노드 목록, 설정 패널 |
| `--raised` | `#1B222B` | 노드 카드, 목록 항목, 버튼 |
| `--raised-hover` | `#232B36` | 마우스를 올린 카드·버튼·목록 항목(어두운 테마라 밝아진다) |
| `--overlay` | `#28313D` | 토스트, 팝오버, 툴팁, 선택 메뉴(그림자와 함께 띄운다) |
| `--grid` | `#252C36` | 캔버스 점 격자 |
| `--border-subtle` | `#242C36` | 영역 사이 구분선 |
| `--border` | `#303A47` | 카드 등 장식 경계 |
| `--border-control` | `#5D6979` | 입력 칸·버튼 경계. 바탕 대비 bg 3.4:1, surface 3.1:1(WCAG 1.4.11). raised 위에서는 2.9:1이라 raised 카드 안에는 입력 칸을 두지 않는다 |

### 글자

| 토큰 | 값 | Tailwind 이름 | 쓰는 곳 |
|---|---|---|---|
| `--text` | `#E4E8EE` | `foreground` | 본문 |
| `--text-label` | `#C9D0D9` | `label` | 입력 칸 라벨, neutral 배지 글자 |
| `--text-muted` | `#97A3B1` | `muted-foreground` | 보조 글자(설명, 시각, 요약) |
| `--text-disabled` | `#6B7684` | `disabled` | 비활성 글자 |

글자색은 `text-text-muted`처럼 이름이 겹치지 않게 Tailwind에서는 shadcn 관례 이름으로 쓴다.

### 강조와 상태

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--accent` | `#5FD4C7` | 선택 테두리, 포커스, 주요 버튼, 실행 중 |
| `--accent-hover` | `#8FE3DA` | 주요 버튼 hover |
| `--accent-soft` | `rgb(95 212 199 / .16)` | 선택된 목록 행 바탕 |
| `--accent-ring` | `rgb(95 212 199 / .22)` | 선택·포커스 바깥 빛 |
| `--success` · `-text` · `-soft` | `oklch(.78 .14 155)` · `oklch(.80 .14 155)` · `/ .16` | 성공 |
| `--warning` · `-text` · `-soft` | `oklch(.80 .14 60)` · `oklch(.84 .12 60)` · `/ .16` | 경고(오래 걸린 노드 등) |
| `--danger` | `#FF6B6B` | 오류 테두리, 거부된 연결 미리보기 선 |
| `--danger-text` | `#FF9A94` | 오류 글자 |
| `--danger-soft` | `#3A1D20` | 오류 배지 바탕 |
| `--danger-strong` | `#B3302B` | 연결 거부 안내 바탕(흰 글자) |

### 노드 종류와 연결선

| 토큰 | 값 | 글리프 |
|---|---|---|
| `--node-trigger` | `oklch(.78 .12 300)` | ▶ |
| `--node-http` | `oklch(.78 .12 245)` | ⇄ |
| `--node-transform` | `oklch(.78 .12 350)` | fx (고정폭, 굵게) |
| `--node-condition` | `oklch(.80 .12 80)` | ◇ |

노드 종류 색은 명도·채도를 맞추고 색상만 다르게 했다. 글리프 칩은 바탕에 `-soft`(같은 색 `/ .16`), 글자에 조금 밝은 `-text`(Trigger·HTTP·Transform `oklch(.80 .12 h)`, Condition `oklch(.84 .12 80)`)를 쓴다.

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--edge` | `#3E8F87` | 연결선 |
| `--edge-active` | `--accent` | 실행 상세에서 지나간 연결선 |
| `--edge-inactive` | `#4A5666` | 실행 상세에서 안 간 갈래(점선 5 5) |

## 글꼴

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `--font-sans` | `'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif` | 본문 전체 |
| `--font-mono` | `'JetBrains Mono', ui-monospace, monospace` | 참조 키, URL, 식, 코드 |

| 단계 | 크기/줄 높이 | Tailwind | 쓰는 곳 |
|---|---|---|---|
| heading | 20/28, 700 | `text-xl` | 페이지 제목 |
| title | 16/24, 700 | `text-base` | 상단 바 제목, 패널 제목 |
| body | 14/20 | `text-sm` | 본문, 입력 칸 |
| body-sm | 13/20 | `text-body-sm` | 노드 제목, 목록 행 |
| label | 12/16, 500 | `text-xs` | 라벨, 배지, 설명 |
| caption | 11/16 | `text-caption` | 노드 종류 이름, 요약. 가장 작은 크기(10px은 쓰지 않는다) |

고정폭: 입력 13, 카드 요약 11, JSON 뷰어 12/20. 굵기는 400·500·700만 쓰고 대문자·자간 처리는 하지 않는다.

## 모양과 간격

| 항목 | 값 |
|---|---|
| 간격 | 4px 격자: 4·8·12·16·24·32. 6·10·14·20은 쓰지 않는다 |
| 영역 안쪽 여백 | 16px(상단 바와 패널 좌우 모두) |
| 모서리 | 4px(글리프 칩, kbd) · 6px(버튼, 입력 칸) · 8px(노드 카드, 카드) · pill(배지) |
| 조작 높이 | sm 28 · md 36 · lg 44. 아이콘만 있는 버튼은 44px |
| 캔버스 격자 | 16px |
| 노드 카드 | 136×84 고정(Condition 136×108), 안쪽 여백 10px 12px |
| 선택된 노드 | 테두리 2px `--accent` + 바깥 4px `--accent-ring` |

## 부품

`apps/web/src/components/ui`. 값은 디자인 리뷰 데모를 따른다.

| 부품 | 값 |
|---|---|
| Button | 높이 36(sm 28, lg 44), 좌우 16, 모서리 6, 14px. **default**: 청록 바탕, 바탕색 글자, 700, hover `--accent-hover`. 화면당 하나. **outline**: `--border-control` 테두리, `--raised` 바탕, hover `--raised-hover`. **ghost**: 좌우 10, 13px, `--text-label`, hover `--raised-hover`. **destructive**: `--danger-soft` 바탕, `--danger-text` 글자. 비활성은 `--text-disabled` |
| Badge | `tone` = neutral·running·success·warning·danger. 높이 22, 좌우 8, 글리프와 글자 사이 4, pill, 12px 500. 바탕은 각 `-soft`(neutral은 `--raised-hover`), 글자는 각 `-text`(running은 `--accent`, neutral은 `--text-label`). 글리프 ● ✓ ▲ !는 부품이 붙인다 |
| Input·Textarea·Select | 높이 36, `--border-control` 1px, `--bg` 바탕, 좌우 12, 14px, 모서리 6. 포커스는 2px `--accent` + 3px `--accent-ring`, 오류는 2px `--danger`. 두꺼워진 테두리만큼 안쪽 여백을 1px 줄여 크기를 유지한다 |
| Field | 라벨 12/16 500 `--text-label`, 라벨과 칸 사이 4, 칸 사이 16. 설명은 12px `--text-muted`, 오류는 12px `--danger-text`에 "! "를 붙인다. 칸이 여럿인 묶음(쿼리·헤더)은 `group`으로 같은 모양을 쓴다 |
| 노드 카드 | 136×84 고정(Condition 136×108), 모서리 8, 안쪽 10/12, 줄 사이 4. 1줄: 글리프 칩 18px + 종류 이름 11px + 오른쪽 상태, 2줄: 제목 13/20 700, 3줄: 설정 요약 고정폭 11px(Condition은 참·거짓 라벨). hover는 `--raised-hover` + `--border-control`, 선택은 2px `--accent` + 4px `--accent-ring`, 오류는 `--danger` 테두리와 "! n", 실행 중은 `--accent` 테두리와 막대, 성공은 기본 테두리와 "✓ 걸린 시간", 건너뜀은 점선·`--surface`·60% |
| 포트 | 12px 원(`--bg` 바탕, 2px `--text-muted`), 누르는 영역 24px. hover는 `--text` 테두리 + `--text-ring`. 선을 끄는 동안 입력 포트는 14px `--accent` + `--accent-glow`, 연결할 수 없는 포트 위에서는 `--danger` 테두리 |
| 상단 바 | 높이 56, 좌우 16, 한 줄. 왼쪽 ← · 이름(글자처럼 보이다 눌러서 편집) · 저장 상태 · 구분선 · 되돌리기/다시 하기(ghost), 오른쪽 문제 배지 · 실행 기록 · 설정(팝오버) · 구분선 · 저장(outline) · 실행(default). 실행 상세도 같은 바를 쓴다 |
| 토스트 | 실행 버튼 아래, `--overlay` 바탕 + 그림자, 12px. 성공은 4초 뒤 저절로 닫히고 실패는 닫기 전까지 남는다 |
| 캔버스 도구 | 왼쪽 아래, 높이 36, `--surface` 바탕, `--border` 테두리. − 배율 + │ 맞춤 보기 |

