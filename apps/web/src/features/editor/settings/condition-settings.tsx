'use client';

import { ExpressionField } from './expression-field';
import type { SettingsProps } from './field';

export function ConditionSettings(props: SettingsProps) {
  return (
    <ExpressionField
      {...props}
      label="조건 식 (JSONata)"
      hint="참이면 '참' 포트로, 아니면 '거짓' 포트로 이어집니다. 예: $nodes.weather_1.body.rain > 0"
    />
  );
}
