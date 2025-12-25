
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound } from 'lucide-react';
import { ChangePasswordForm } from '@/components/change-password-form';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">Change Your Password</CardTitle>
          <CardDescription>For your security, you must change your temporary password before proceeding.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm onPasswordChanged={() => {
            // The router refresh is handled by the form itself,
            // but we can also explicitly push to the dashboard as a fallback.
            router.push('/dashboard');
          }} />
        </CardContent>
      </Card>
    </div>
  );
}
