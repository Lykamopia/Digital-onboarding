'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Logo from '@/components/logo';
import { Loader2, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { verifyPasswordResetToken, setPasswordWithToken } from '@/app/actions/memo';
import { passwordSchema, passwordRules } from '@/lib/password-policy';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const setPasswordFormSchema = z.object({
    password: passwordSchema,
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ['confirmPassword'],
});

type SetPasswordFormData = z.infer<typeof setPasswordFormSchema>;

export default function SetPasswordClientPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<SetPasswordFormData>({
        resolver: zodResolver(setPasswordFormSchema),
        mode: 'onTouched',
    });

    const password = watch('password');

    useEffect(() => {
        if (!token) {
            setError('No verification token provided. Please check the link in your email.');
            setVerifying(false);
            return;
        }

        async function verifyToken() {
            const result = await verifyPasswordResetToken(token!);
            if (result.error) {
                setError(result.error);
            } else if (result.success && result.email) {
                setEmail(result.email);
            }
            setVerifying(false);
        }
        verifyToken();
    }, [token]);

    const onSubmit = async (data: SetPasswordFormData) => {
        if (!token) return;
        setLoading(true);
        const result = await setPasswordWithToken({ token, password: data.password });

        if (result.success) {
            toast.success('Password Set Successfully', {
                description: 'You can now log in with your new password.',
            });
            router.push('/login');
        } else {
            setLoading(false);
            setError(result.error || 'An unknown error occurred.');
        }
    };

    const renderContent = () => {
        if (verifying) {
            return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
        }

        if (error) {
            return (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Link Invalid or Expired</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                    <div className="mt-4">
                        <Link href="/login">
                            <Button variant="link">Return to Login</Button>
                        </Link>
                    </div>
                </Alert>
            );
        }

        return (
             <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            {...register('password')}
                        />
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 right-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                     <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            {...register('confirmPassword')}
                        />
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute inset-y-0 right-0 h-full px-3"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>

                <PasswordStrengthIndicator password={password} rules={passwordRules} />
                
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Setting Password...
                        </>
                    ) : (
                        'Set Password and Login'
                    )}
                </Button>
            </form>
        );
    }
    
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20 p-4">
            <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full" />
            <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full" />
            
            <svg
                viewBox="0 0 1024 1024"
                className="absolute left-1/3 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
                aria-hidden="true"
            >
                <circle cx={512} cy={512} r={512} fill="url(#9a759170-4320-4e94-a7de-180a42ebb9e1)" fillOpacity="0.7" />
                <defs>
                <radialGradient id="9a759170-4320-4e94-a7de-180a42ebb9e1">
                    <stop stopColor="hsl(var(--primary))" />
                    <stop offset={1} stopColor="hsl(var(--accent))" />
                </radialGradient>
                </defs>
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" className="absolute top-1/4 left-1/4 w-64 h-64 text-primary/10 -rotate-12">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" className="absolute bottom-1/4 right-1/4 w-64 h-64 text-accent/20 rotate-12">
                <path d="M22 2L11 13" />
                <path d="m22 2-7 20-4-9-9-4Z" />
            </svg>

            <Card className="w-full max-w-md z-10 backdrop-blur-sm bg-card/60">
                <CardHeader className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Set Your Password</CardTitle>
                    <CardDescription>Create a secure password for your account to complete setup.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}
