import type { NodeType } from '@nodeloom/core';

// 팔레트와 노드 카드에 보여 줄 이름과 설명.
export const NODE_META: Record<
  NodeType,
  { label: string; description: string }
> = {
  trigger: {
    label: 'Trigger',
    description: '흐름 시작(직접 실행 또는 정해진 시각)',
  },
  http: { label: 'HTTP 요청', description: '주소를 호출해 응답 받기' },
  transform: { label: 'Transform', description: 'JSONata 식으로 데이터 가공' },
  condition: { label: 'Condition', description: '참·거짓에 따라 갈래 나누기' },
};

export const PORT_LABEL: Record<string, string> = { true: '참', false: '거짓' };

// 팔레트에서 캔버스로 끌어 놓을 때 쓰는 데이터 형식.
export const DRAG_MIME = 'application/x-nodeloom-node-type';
