import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// "! 문구" 꼴의 오류 표시. 색 없이도 알 수 있게 글리프를 붙인다. issues가 있으면 아래에 목록으로.
export function InlineError({
  message,
  issues,
  className,
  ...props
}: ComponentProps<'div'> & {
  message: string;
  issues?: { message: string }[];
}) {
  return (
    <div className={cn('text-sm text-danger-text', className)} {...props}>
      <p>
        <span aria-hidden>! </span>
        {message}
      </p>
      {issues && issues.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-xs">
          {issues.map((i) => (
            <li key={i.message}>{i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
