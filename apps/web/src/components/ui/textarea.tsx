import * as React from 'react';
import { cn } from '@/lib/utils';
import { CONTROL, CONTROL_FOCUS, CONTROL_INVALID } from './control-styles';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full px-3 py-2 focus-visible:px-[11px] focus-visible:py-[7px] aria-invalid:px-[11px] aria-invalid:py-[7px]',
        CONTROL,
        CONTROL_FOCUS,
        CONTROL_INVALID,
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
