
import { Suspense } from 'react';
import ChangePasswordClientPage from './change-password-client';
import { HoneycombLoader } from '@/components/honeycomb-loader';

export default function ChangePasswordPageContainer() {
  return (
    <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
      <ChangePasswordClientPage />
    </Suspense>
  );
}
