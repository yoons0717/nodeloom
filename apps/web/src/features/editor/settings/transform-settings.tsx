'use client';

import { HelpCode } from '../help';
import { ExpressionField } from './expression-field';
import type { SettingsProps } from './field';

export function TransformSettings(props: SettingsProps) {
  return (
    <ExpressionField
      {...props}
      label="변환 식"
      hint="결과가 이 노드의 출력이 됩니다"
      help={
        <>
          <p>
            식의 결과가 그대로 출력이 돼요. 객체를 만들면 다음 노드에서 그 필드
            이름으로 읽을 수 있어요.
          </p>
          <HelpCode note="→ 다음 노드에서 down">
            {'{ "down": [servers[up=false].name] }'}
          </HelpCode>
        </>
      }
    />
  );
}
