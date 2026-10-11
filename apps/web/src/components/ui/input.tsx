import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';
import { CONTROL, CONTROL_FOCUS, CONTROL_INVALID } from './control-styles';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 px-3 focus-visible:px-[11px] aria-invalid:px-[11px]',
        CONTROL,
        CONTROL_FOCUS,
        CONTROL_INVALID,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
