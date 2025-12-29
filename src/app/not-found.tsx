
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NotFoundIllustration } from '@/components/not-found-illustration';
import { ArrowLeft } from 'lucide-react';
import { AnimatedContent } from '@/components/animated-content';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-muted/20 p-4">
      <AnimatedContent>
        <Card className="w-full max-w-lg text-center shadow-2xl">
            <CardHeader>
                <div className="mx-auto mb-6">
                    <NotFoundIllustration />
                </div>
                <CardTitle className="text-4xl font-bold text-primary">404 - Page Not Found</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                    Oops! The page you're looking for seems to have flown away.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="mb-6">
                    Let's get you back on track. You can return to your main dashboard.
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
