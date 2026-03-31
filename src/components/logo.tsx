
import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  hideText?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export default function Logo({ className, hideText = false, layout = 'horizontal' }: LogoProps) {
  const isVertical = layout === 'vertical';
  const imageSize = isVertical ? 64 : 32;

  return (
    <div className={cn(
      'flex items-center', 
      isVertical ? 'flex-col gap-2' : 'flex-row gap-2',
      className
    )}>
      <Image 
        src="/Logo.png" 
        alt="NibTera Onboarding Logo" 
        width={imageSize} 
        height={imageSize} 
        className="object-contain"
      />
      {!hideText && (
        <span className={cn(
            "font-bold text-primary",
            isVertical ? 'text-2xl' : 'text-xl'
        )}>
            NibTera Onboarding
        </span>
      )}
    </div>
  );
}
