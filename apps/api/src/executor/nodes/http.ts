import {
  type EvalContext,
  evaluate,
  fillTemplate,
  type NodeConfig,
} from '@nodeloom/core';
import type { Dispatcher } from 'undici';
import { NodeError } from './node-error.js';
import type { NodeResult, RunNodeOptions } from './run-node.js';

// 응답 본문 상한(DECISIONS 8-1)
export const MAX_RESPONSE_BYTES = 1024 * 1024;

// 다시 보내면 결과가 달라질 수 있는 응답 코드(DECISIONS 7-3)
const isRetryableStatus = (s: number) => s >= 500 || s === 408 || s === 429;

// 요청을 한 번 보낸다. 2xx가 아니면 실패이고, "2xx가 아니어도 계속"이 켜져 있으면 항상 { status, body }를 내보낸다(DECISIONS 3-3).
export async function runHttp(
  config: NodeConfig<'http'>,
  ctx: EvalContext,
  { signal, guard }: RunNodeOptions,
): Promise<NodeResult> {
  const request = await buildRequest(config, ctx);
  // 보내기 전에 주소를 검사하고, 연결 직전 IP 검사를 하는 연결을 받는다(DECISIONS 8-1).
  const dispatcher = guard.check(new URL(request.url));

  let res: Response;
  let body: unknown;
  try {
    // Node 내장 fetch는 undici의 dispatcher를 받지만 RequestInit 타입에는 없다.
    const init: RequestInit & { dispatcher?: Dispatcher } = {
      dispatcher,
      // 리다이렉트는 따라가지 않는다. 3xx는 2xx가 아니므로 실패(DECISIONS 8-1)
      redirect: 'manual',
      signal: AbortSignal.any([
        AbortSignal.timeout(config.timeoutSec * 1000),
        ...(signal ? [signal] : []),
      ]),
    };
    res = await fetch(request, init);
    body = parseBody(await readLimited(res), res.headers.get('content-type'));
  } catch (e) {
    if (e instanceof NodeError) throw e;
    const blocked = guard.blockedMessage(e);
    if (blocked) throw new NodeError(blocked);
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new NodeError(`${config.timeoutSec}초 안에 응답이 없습니다`, true);
    }
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    throw new NodeError(
      `연결하지 못했습니다${cause ? ` (${cause})` : ''}`,
      true,
    );
  }

  if (config.continueOnNon2xx) return { output: { status: res.status, body } };
  if (!res.ok) {
    throw new NodeError(
      `응답 코드 ${res.status}`,
      isRetryableStatus(res.status),
      { status: res.status, body },
    );
  }
  return { output: body };
}

// 칸을 채워 요청을 만든다. 여기서 나는 오류는 다시 보내도 같으므로 재시도하지 않는다.
async function buildRequest(config: NodeConfig<'http'>, ctx: EvalContext) {
  const fill = async (r: Record<string, string>) =>
    Promise.all(
      Object.entries(r).map(
        async ([k, v]) => [k, await fillTemplate(v, ctx)] as [string, string],
      ),
    );

  const url = await fillTemplate(config.url, ctx);
  const query = await fill(config.query);
  const headers = await fill(config.headers);
  // 본문은 객체를 만드는 식 하나(DECISIONS A-3)
  const body = config.body.trim()
    ? JSON.stringify(await evaluate(config.body, ctx))
    : undefined;

  try {
    const u = new URL(url);
    for (const [k, v] of query) u.searchParams.append(k, v);
    const h = new Headers(headers);
    if (body !== undefined && !h.has('content-type'))
      h.set('content-type', 'application/json');
    return new Request(u, { method: config.method, headers: h, body });
  } catch (e) {
    throw new NodeError(`요청을 만들 수 없습니다: ${(e as Error).message}`);
  }
}

// 1MB를 넘는 순간 읽기를 멈춘다. Content-Length는 믿지 않고 실제로 읽은 양으로 센다.
async function readLimited(res: Response): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body ?? []) {
    size += chunk.length;
    if (size > MAX_RESPONSE_BYTES) {
      throw new NodeError(
        `응답이 ${MAX_RESPONSE_BYTES / 1024 / 1024}MB를 넘습니다`,
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseBody(text: string, contentType: string | null): unknown {
  if (contentType?.includes('json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}
