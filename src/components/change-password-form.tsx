
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { changeUserPassword } from '@/app/actions/memo';

const changePasswordSchema = z.object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

interface ChangePasswordFormProps {
    onPasswordChanged?: () => void;
}

export function ChangePasswordForm({ onPasswordChanged }: ChangePasswordFormProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ChangePasswordFormData>({
        resolver: zodResolver(changePasswordSchema),
    });

    const onSubmit = async (data: ChangePasswordFormData) => {
        setLoading(true);
        const result = await changeUserPassword(data.newPassword);
        setLoading(false);

        if (result.success) {
            toast({
                title: 'Password Changed',
                description: 'Your password has been successfully updated.',
            });
            
            if (onPasswordChanged) {
                onPasswordChanged();
            } else {
                router.push('/dashboard/inbox');
                router.refresh(); 
            }
            reset();
        } else {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error || 'An unknown error occurred.',
            });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
            <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                    id="newPassword"
                    type="password"
                    {...register('newPassword')}
                />
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword')}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
            </Button>
        </form>
    );
}
