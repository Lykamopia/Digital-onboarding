
import { Suspense } from 'react';
import SetPasswordClientPage from './set-password-client';
import { HoneycombLoader } from '@/components/honeycomb-loader';

export default function SetPasswordPageContainer() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
      <SetPasswordClientPage />
    </Suspense>
  );
}
