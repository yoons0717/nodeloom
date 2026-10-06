import type { NodeType } from '@nodeloom/core';

// 팔레트와 노드 카드에 보여 줄 이름과 설명.
export const NODE_META: Record<
  NodeType,
  { label: string; description: string }
> = {
  trigger: {
    label: 'Trigger',
    description: '흐름의 시작. 수동 실행이나 스케줄',
  },
  http: { label: 'HTTP 요청', description: '주소를 호출하고 응답을 받음' },
  transform: { label: 'Transform', description: 'JSONata 식으로 데이터 가공' },
  condition: { label: 'Condition', description: '참·거짓에 따라 다른 길로' },
};

export const PORT_LABEL: Record<string, string> = { true: '참', false: '거짓' };

// 팔레트에서 캔버스로 끌어 놓을 때 쓰는 데이터 형식.
export const DRAG_MIME = 'application/x-nodeloom-node-type';
