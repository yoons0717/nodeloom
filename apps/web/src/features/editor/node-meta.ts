import type { GraphNode, NodeType } from '@nodeloom/core';
import { describeSchedule, parseSchedule } from './settings/schedule';

type NodeMeta = {
  // 종류 이름은 영문으로 고정한다. 사용자 제목은 한글로 쓴다.
  label: string;
  // 새 노드의 제목 기본값. 종류 이름과 겹치지 않게 한글로 쓴다.
  defaultTitle: string;
  // 노드 목록의 짧은 설명
  description: string;
  // 설명에는 없지만 노드 검색에서 찾히게 할 낱말
  keywords: string;
  // 노드 목록 도움말(M6 6-i): 하는 일, 다음 노드가 받는 값
  does: string;
  passes: string;
  glyph: string;
  // 글리프 칩의 바탕(-soft)과 글자(-text). Tailwind가 찾을 수 있게 클래스 이름을 그대로 적는다.
  chipClass: string;
  // fx는 고정폭 굵은 글자로 쓴다.
  glyphClass?: string;
  // ▶는 다른 글리프보다 커 보여서 한 단계 작게 쓴다(데모: 칩 18px에 9px, 24px에 11px).
  smallGlyph?: boolean;
};

export const NODE_META: Record<NodeType, NodeMeta> = {
  trigger: {
    label: 'Trigger',
    defaultTitle: '시작',
    description: '흐름의 시작',
    keywords: '수동 스케줄',
    does: '흐름의 시작. 직접 실행하거나 정해진 시각에 실행',
    passes: '직접 실행: 테스트 입력 JSON · 스케줄: {}',
    glyph: '▶',
    chipClass: 'bg-node-trigger-soft text-node-trigger-text',
    smallGlyph: true,
  },
  http: {
    label: 'HTTP',
    defaultTitle: 'HTTP 요청',
    description: '요청 보내고 응답 받기',
    keywords: 'API 호출',
    does: '주소로 요청을 보내고 응답을 받음',
    passes: '응답 본문',
    glyph: '⇄',
    chipClass: 'bg-node-http-soft text-node-http-text',
  },
  transform: {
    label: 'Transform',
    defaultTitle: '데이터 가공',
    description: '식으로 데이터 만들기',
    keywords: 'JSONata 가공',
    does: '식으로 데이터를 새로 만듦',
    passes: '식의 결과',
    glyph: 'fx',
    chipClass: 'bg-node-transform-soft text-node-transform-text',
    glyphClass: 'font-mono font-bold tracking-[-0.04em]',
  },
  condition: {
    label: 'Condition',
    defaultTitle: '조건 분기',
    description: '참/거짓으로 나누기',
    keywords: '분기',
    does: '식이 참이면 참 포트로, 거짓이면 거짓 포트로',
    passes: '받은 입력 그대로',
    glyph: '◇',
    chipClass: 'bg-node-condition-soft text-node-condition-text',
  },
};

export const PORT_LABEL: Record<string, string> = { true: '참', false: '거짓' };

// 노드 카드 셋째 줄에 보여 줄 설정 요약. 패널을 열지 않고도 흐름을 읽을 수 있게 한다.
export function summarizeNode(node: GraphNode): string {
  const c = node.config;
  switch (node.type) {
    case 'trigger': {
      const cron = typeof c.cron === 'string' ? c.cron : null;
      return describeSchedule(parseSchedule(cron)) ?? '직접 실행';
    }
    case 'http': {
      const method = typeof c.method === 'string' ? c.method : 'GET';
      const url = typeof c.url === 'string' ? c.url : '';
      return `${method} ${pathOf(url)}`.trim();
    }
    case 'transform':
    case 'condition': {
      const e = typeof c.expression === 'string' ? c.expression : '';
      return e.replace(/\s+/g, ' ').trim();
    }
  }
}

// 주소에서 경로만. `{{ }}`가 섞여 해석할 수 없으면 적은 그대로 보여 준다.
function pathOf(url: string) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

// 팔레트에서 캔버스로 끌어 놓을 때 쓰는 데이터 형식.
export const DRAG_MIME = 'application/x-nodeloom-node-type';
