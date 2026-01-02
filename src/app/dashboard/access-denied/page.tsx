
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccessDeniedIllustration } from '@/components/access-denied-illustration';
import { ArrowLeft } from 'lucide-react';
import { AnimatedContent } from '@/components/animated-content';

export default function AccessDeniedPage() {
  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] items-center justify-center bg-muted/20 p-4">
       <AnimatedContent>
        <Card className="w-full max-w-md text-center shadow-2xl">
            <CardHeader>
            <div className="mx-auto mb-6">
                <AccessDeniedIllustration />
            </div>
            <CardTitle className="text-3xl font-bold text-destructive">Access Denied</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
                You do not have the necessary permissions to view this page.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <p className="mb-6">
                If you believe you should have access, please contact your system administrator.
            </p>
            <Link href="/dashboard/inbox">
                <Button>
                <ArrowLeft className="mr-2" />
                Go to Dashboard
                </Button>
            </Link>
            </CardContent>
        </Card>
       </AnimatedContent>
    </div>
  );
}
