
'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { changeUserPassword } from '@/app/actions/memo';
import { passwordSchema, passwordRules } from '@/lib/password-policy';
import { PasswordStrengthIndicator } from '@/components/password-strength-indicator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { signOut } from 'next-auth/react';

const changePasswordSchema = z.object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export default function ChangePasswordClientPage() {
    const [loading, setLoading] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ChangePasswordFormData>({
        resolver: zodResolver(changePasswordSchema),
        mode: 'onTouched'
    });
    
    const newPassword = watch('newPassword');

    const onSubmit = async (data: ChangePasswordFormData) => {
        setLoading(true);
        const result = await changeUserPassword(data.newPassword);

        if (result.success) {
            toast.success('Password Changed', {
                description: 'Your password has been updated successfully.',
            });
            // You might want to sign out the user to force them to log in with the new password
            signOut({ callbackUrl: '/login' });
        } else {
            setLoading(false);
            toast.error('Update Failed', {
                description: result.error || 'An unknown error occurred.',
            });
        }
    };

    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <KeyRound className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Update your account password here.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    {...register('newPassword')}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute inset-y-0 right-0 h-full px-3"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    <span className="sr-only">{showNewPassword ? 'Hide password' : 'Show password'}</span>
                                </Button>
                            </div>
                            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
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
                                    <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
                                </Button>
                            </div>
                            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                        </div>

                        <PasswordStrengthIndicator password={newPassword} rules={passwordRules} />
                        
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
