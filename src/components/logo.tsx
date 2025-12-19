import { Mailbox } from 'lucide-react';

export default function Logo() {
  return (
    <div className="flex items-center gap-2 text-lg font-semibold text-primary">
      <Mailbox className="h-6 w-6" />
      <span className="font-headline">Nib Memo</span>
    </div>
  );
}
