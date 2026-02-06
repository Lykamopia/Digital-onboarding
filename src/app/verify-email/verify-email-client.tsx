
'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Logo from '@/components/logo';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { verifyEmailChange } from '@/app/actions/memo';
import Link from 'next/link';

export default function VerifyEmailClientPage() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<{ success: boolean; message: string; } | null>(null);
    
    useEffect(() => {
        if (!token) {
            setResult({ success: false, message: 'No verification token provided. Please check the link in your email.' });
            setLoading(false);
            return;
        }

        async function verifyToken() {
            const verificationResult = await verifyEmailChange(token!);
            setResult({ success: verificationResult.success, message: verificationResult.error || verificationResult.message || 'An unknown error occurred.' });
            setLoading(false);
        }
        verifyToken();
    }, [token]);

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-muted-foreground">Verifying your email...</p>
                </div>
            );
        }

        if (result?.success) {
             return (
                <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <p className="font-semibold text-lg">Email Verified!</p>
                    <p className="text-muted-foreground">{result.message}</p>
                    <Link href="/login">
                        <Button>Return to Login</Button>
                    </Link>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <p className="font-semibold text-lg">Verification Failed</p>
                <p className="text-muted-foreground">{result?.message}</p>
                <Link href="/login">
                    <Button variant="outline">Return to Login</Button>
                </Link>
            </div>
        );
    }
    
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-4">
            <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full" />
            <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full" />
            <Card className="w-full max-w-md z-10 backdrop-blur-sm bg-card/60">
                <CardHeader className="text-center">
                    <div className="mb-4 flex justify-center">
                        <Logo layout="vertical" />
                    </div>
                    <CardTitle className="text-2xl">Email Verification</CardTitle>
                    <CardDescription>Finalizing your email address change.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}
