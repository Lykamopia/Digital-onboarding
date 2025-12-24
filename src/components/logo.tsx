import { cn } from '@/lib/utils';
import Image from 'next/image';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  hideText?: boolean;
}

export default function Logo({ className, hideText = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image src="/Logo.jpeg" alt="Nib Memo Logo" width={32} height={32} />
      {!hideText && (
        <span className="text-xl font-bold text-primary">Nib Memo</span>
      )}
    </div>
  );
}
