'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// 상단 바에는 짧게 "데모"만, 설명은 툴팁으로(M6 6-f).
export function DemoBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Badge tabIndex={0} className="cursor-help" />}>
          데모
        </TooltipTrigger>
        <TooltipContent side="bottom">
          로그인 없이 누구나 편집할 수 있는 데모 서버입니다. 실행은 연습용
          주소로만 할 수 있습니다.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
