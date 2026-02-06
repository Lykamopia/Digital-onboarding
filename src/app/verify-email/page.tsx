
import { Suspense } from 'react';
import VerifyEmailClientPage from './verify-email-client';
import { HoneycombLoader } from '@/components/honeycomb-loader';

export default function VerifyEmailPageContainer() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-background"><HoneycombLoader /></div>}>
      <VerifyEmailClientPage />
    </Suspense>
  );
}
