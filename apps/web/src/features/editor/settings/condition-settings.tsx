'use client';

import { HelpCode } from '../help';
import { ExpressionField } from './expression-field';
import type { SettingsProps } from './field';

export function ConditionSettings(props: SettingsProps) {
  return (
    <ExpressionField
      {...props}
      label="조건 식"
      hint="참이면 '참' 포트로, 아니면 '거짓' 포트로 이어집니다"
      help={
        <>
          <p>
            식이 정확히 true면 참 포트로, false면 거짓 포트로 보내요. 그 밖의
            값(숫자, 빈 값 등)이 나오면 실패해요. 받은 입력은 바꾸지 않고 다음
            노드에 그대로 넘겨요.
          </p>
          <div className="flex flex-col gap-1">
            <HelpCode>$count(down) &gt; 0</HelpCode>
            <HelpCode>
              level = &quot;error&quot; and service = &quot;결제 서버&quot;
            </HelpCode>
          </div>
          <p className="text-xs leading-[18px] text-muted-foreground">
            비교{' '}
            <code className="font-mono text-foreground">= != &gt; &lt;</code> ·
            묶기 <code className="font-mono text-foreground">and or not()</code>
          </p>
        </>
      }
    />
  );
}
