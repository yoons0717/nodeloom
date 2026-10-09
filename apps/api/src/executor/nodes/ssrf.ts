import dns, { type LookupAddress, type LookupOptions } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { Agent } from 'undici';
import { NodeError } from './node-error.js';

// HTTP 노드가 보낼 수 있는 곳(DECISIONS 8-1, B-7, 1-3)
export type HttpPolicy = {
  // 연습용 응답 주소(예: http://localhost:4000/mock). 이 아래 주소는 검사 없이 허용한다.
  mockBase: string;
  // 데모 서버면 연습용 응답만 허용한다.
  demo: boolean;
  // 예외로 허용할 내부 IP 또는 대역(HTTP_ALLOW_PRIVATE)
  allowPrivate: string[];
};

const BLOCKED = 'NODELOOM_BLOCKED_ADDRESS';

// 클라우드 메타데이터 주소. 허용 목록에 있어도 막는다.
const metadata = new BlockList();
metadata.addAddress('169.254.169.254');
metadata.addAddress('100.100.100.200');
metadata.addAddress('fd00:ec2::254', 'ipv6');

// 내부 주소: loopback, 사설, 링크 로컬(DECISIONS 8-1)
// IPv4를 IPv6로 감싼 형태(::ffff:127.0.0.1)는 BlockList가 IPv4 규칙으로 함께 검사한다.
// 반대로 ::ffff:0:0/96 같은 IPv6 규칙을 넣으면 BlockList가 모든 IPv4를 그 규칙에 맞춰 봐서 바깥 주소까지 막힌다.
const internal = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], // 0.0.0.0으로 연결하면 서버 자신으로 간다
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // 통신사·Tailscale 내부망
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  internal.addSubnet(net, prefix);
}
for (const [net, prefix] of [
  ['::', 127], // ::, ::1
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  internal.addSubnet(net, prefix, 'ipv6');
}

function allowList(entries: string[]) {
  const list = new BlockList();
  for (const entry of entries) {
    const [ip, prefix] = entry.split('/');
    const type = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
    if (prefix === undefined) list.addAddress(ip, type);
    else list.addSubnet(ip, Number(prefix), type);
  }
  return list;
}

// 연결할 IP가 막힌 곳이면 이유를, 아니면 null
function blockedReason(ip: string, allow: BlockList): string | null {
  const type = isIP(ip) === 6 ? 'ipv6' : 'ipv4';
  if (metadata.check(ip, type)) return '클라우드 메타데이터 주소';
  if (internal.check(ip, type) && !allow.check(ip, type)) return '내부 주소';
  return null;
}

export function createHttpGuard(policy: HttpPolicy) {
  const allow = allowList(policy.allowPrivate);
  const mockPrefix = `${policy.mockBase.replace(/\/$/, '')}/`;

  // 이름을 IP로 한 번만 바꾸고, 검사한 그 IP로 연결한다. 검사 뒤에 다시 조회하지 않아 DNS 재바인딩이 통하지 않는다.
  const dispatcher = new Agent({
    connect: {
      lookup: (
        hostname: string,
        options: LookupOptions,
        callback: (
          err: NodeJS.ErrnoException | null,
          address: string | LookupAddress[],
          family?: number,
        ) => void,
      ) => {
        dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
          if (err) return callback(err, []);
          for (const a of addresses) {
            const reason = blockedReason(a.address, allow);
            if (reason) {
              const blocked = Object.assign(
                new Error(`${reason}(${a.address})로는 요청할 수 없습니다`),
                { code: BLOCKED },
              );
              return callback(blocked, []);
            }
          }
          if (options.all) return callback(null, addresses);
          callback(null, addresses[0].address, addresses[0].family);
        });
      },
    },
  });

  return {
    // 요청 전에 부른다. 연습용 응답이면 검사 없는 기본 연결(undefined)을, 아니면 검사하는 연결을 돌려준다.
    check(url: URL) {
      if (url.href.startsWith(mockPrefix)) return undefined;
      if (policy.demo) {
        throw new NodeError(
          '데모에서는 연습용 주소(/mock)로만 요청할 수 있습니다',
        );
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new NodeError('http, https 주소만 요청할 수 있습니다');
      }
      // IP를 바로 적은 주소는 이름 조회를 거치지 않으므로 여기서 검사한다.
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(host)) {
        const reason = blockedReason(host, allow);
        if (reason)
          throw new NodeError(`${reason}(${host})로는 요청할 수 없습니다`);
      }
      return dispatcher;
    },
    // fetch 오류가 위 검사에 걸린 것인지
    blockedMessage(e: unknown): string | undefined {
      const cause = (e as { cause?: { code?: string; message?: string } })
        .cause;
      return cause?.code === BLOCKED ? cause.message : undefined;
    },
  };
}

export type HttpGuard = ReturnType<typeof createHttpGuard>;
