import {
  type EvalContext,
  evaluate,
  ExpressionError,
  type GraphNode,
  NODE_SPECS,
} from '@nodeloom/core';
import { runHttp } from './http.js';
import { NodeError } from './node-error.js';
import type { HttpGuard } from './ssrf.js';

// output: 다음 노드의 입력. port: Condition이 나간 포트
export type NodeResult = { output: unknown; port?: string };

export type RunNodeOptions = {
  // 실행 전체 시간 제한에 걸리면 진행 중인 요청을 끊는다.
  signal?: AbortSignal;
  guard: HttpGuard;
};

// 노드 하나를 한 번 실행한다. 재시도와 기록은 실행 엔진이 한다.
// Trigger의 입력(ctx.input)은 실행 엔진이 실행 종류에 따라 넣는다(DECISIONS B-10).
export async function runNode(
  node: GraphNode,
  ctx: EvalContext,
  options: RunNodeOptions,
): Promise<NodeResult> {
  try {
    switch (node.type) {
      case 'trigger':
        return { output: ctx.input };
      case 'transform': {
        const { expression } = NODE_SPECS.transform.config.parse(node.config);
        return { output: (await evaluate(expression, ctx)) ?? null };
      }
      case 'condition': {
        const { expression } = NODE_SPECS.condition.config.parse(node.config);
        const result = await evaluate(expression, ctx);
        // 정확히 true·false가 아니면 조용히 거짓으로 보내지 않고 실패(DECISIONS A-2)
        if (typeof result !== 'boolean') {
          const shown = JSON.stringify(result) ?? 'undefined';
          throw new NodeError(
            `조건 결과가 참·거짓이 아닙니다: ${shown.length > 100 ? `${shown.slice(0, 100)}…` : shown}`,
          );
        }
        return { output: ctx.input, port: String(result) };
      }
      case 'http':
        return await runHttp(
          NODE_SPECS.http.config.parse(node.config),
          ctx,
          options,
        );
    }
  } catch (e) {
    if (e instanceof ExpressionError) throw new NodeError(e.message);
    throw e;
  }
}
