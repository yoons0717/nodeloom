// 입력 칸·선택 칸이 함께 쓰는 테두리와 상태(DESIGN.md). 테두리가 2px로 두꺼워질 때 안쪽 여백을 1px 줄여 크기를 유지한다.
export const CONTROL =
  'rounded-md border border-border-control bg-bg text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-disabled';
export const CONTROL_FOCUS =
  'focus-visible:border-2 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-ring';
export const CONTROL_INVALID =
  'aria-invalid:border-2 aria-invalid:border-danger';
