// 노드 실행 실패. retryable이면 실행 엔진이 다시 시도한다(DECISIONS 7-3).
// details는 실행 기록에 오류와 함께 남길 값(예: 응답 코드와 본문)이다.
export class NodeError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
