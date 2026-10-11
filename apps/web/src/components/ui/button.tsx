import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// 버튼 값은 디자인 리뷰 데모를 따른다(DESIGN.md). 주요 버튼(default)은 화면에 하나만 둔다.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent-ring disabled:pointer-events-none disabled:text-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-accent font-bold text-bg hover:bg-accent-hover disabled:bg-raised-hover',
        outline: 'border-border-control bg-raised hover:bg-raised-hover',
        ghost: 'text-body-sm text-label hover:bg-raised-hover',
        destructive: 'bg-danger-soft text-danger-text',
        link: 'text-accent underline-offset-4 hover:text-accent-hover hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-7 px-3 text-body-sm',
        lg: 'h-11 px-4',
        icon: 'size-11',
        'icon-md': 'size-9',
        'icon-sm': 'size-7',
      },
    },
    // 데모의 ghost 버튼은 좌우 10px이다.
    compoundVariants: [{ variant: 'ghost', size: 'default', class: 'px-2.5' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
