import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  hideText?: boolean;
}

export default function Logo({ hideText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-lg font-semibold text-primary", className)}>
      <Image src="/Logo.png" alt="Nib Memo Logo" width={32} height={32} />
      {!hideText && <span className="font-headline">Nib Memo</span>}
    </div>
  );
}
