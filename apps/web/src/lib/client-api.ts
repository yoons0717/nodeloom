export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// 브라우저에서 Next의 /api/*를 부른다. 실패하면 서버가 준 한국어 메시지를 담아 던진다.
export async function clientApi(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: unknown };
    throw new ApiError(
      typeof body.message === 'string' ? body.message : '요청에 실패했습니다',
      res.status,
    );
  }
  return res.status === 204 ? undefined : res.json();
}
