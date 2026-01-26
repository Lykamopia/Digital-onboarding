
'use client';
import { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { HoneycombLoader } from '@/components/honeycomb-loader';

export default function DeprecatedChangePasswordPage() {
    useEffect(() => {
        // This page is no longer used for forced redirects.
        // Password changes are now done via the profile page.
        redirect('/dashboard/profile');
    }, []);

    return (
        <div className="h-full w-full flex items-center justify-center">
            <HoneycombLoader />
        </div>
    );
}
