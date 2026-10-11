'use client';

import { ExpressionField } from './expression-field';
import type { SettingsProps } from './field';

export function TransformSettings(props: SettingsProps) {
  return (
    <ExpressionField
      {...props}
      label="변환 식"
      hint="결과가 이 노드의 출력이 됩니다. 예: { 'text': $nodes.weather_1.body.summary }"
    />
  );
}
