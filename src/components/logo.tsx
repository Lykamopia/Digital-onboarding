import { Mailbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  hideText?: boolean;
}

export default function Logo({ hideText = false, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2 text-lg font-semibold text-primary", className)}>
      <Mailbox className="h-6 w-6" />
      {!hideText && <span className="font-headline">Nib Memo</span>}
    </div>
  );
}
