
'use client';
import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "sonner";
import Logo from '@/components/logo';
import { Loader2, ArrowRight, Mail, Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getUserLockoutStatus } from '@/app/actions/memo';

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    trigger
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get('email') || '',
      password: '',
    }
  });

  const email = watch('email');

  const checkLockout = useCallback(async (currentEmail: string) => {
    if (!currentEmail) return;
    const lockoutStatus = await getUserLockoutStatus(currentEmail);
    if (lockoutStatus?.lockoutUntil) {
        const lockoutDate = new Date(lockoutStatus.lockoutUntil);
        const now = new Date();
        if (now < lockoutDate) {
            const timeLeft = Math.ceil((lockoutDate.getTime() - now.getTime()) / 1000);
            setLockoutTimeLeft(timeLeft);
        } else {
            setLockoutTimeLeft(null);
        }
    } else {
        setLockoutTimeLeft(null);
    }
  }, []);

  useEffect(() => {
    if (email && isDirty) {
        trigger('email').then(isValid => {
            if(isValid) checkLockout(email);
        });
    } else if (email) {
        checkLockout(email);
    }
  }, [email, checkLockout, isDirty, trigger]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (lockoutTimeLeft !== null && lockoutTimeLeft > 0) {
      timer = setInterval(() => {
        setLockoutTimeLeft(prev => (prev ? prev - 1 : 0));
      }, 1000);
    } else if (lockoutTimeLeft === 0) {
        setLockoutTimeLeft(null); // Unlock
    }
    return () => clearInterval(timer);
  }, [lockoutTimeLeft]);
  

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard/inbox';

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'SessionExpired') {
        toast.warning('Session Expired', {
            description: 'You have been logged out due to inactivity. Please log in again.',
        });
        router.replace('/login', {scroll: false});
    } else if (error && error !== 'CredentialsSignin') { // Handle NextAuth's generic error
        toast.error('Login Failed', {
            description: error,
        });
        router.replace('/login', {scroll: false});
    }
  }, [searchParams, router]);


  const onSubmit = async (data: LoginFormData) => {
    await checkLockout(data.email);
    if (lockoutTimeLeft && lockoutTimeLeft > 0) return;

    setLoading(true);
    
    // We sign in with redirect: false to handle the response here
    const result = await signIn('credentials', {
      redirect: false,
      email: data.email,
      password: data.password,
    });

    setLoading(false);

    if (result?.error) {
      await checkLockout(data.email);
      toast.error('Login Failed', {
          description: result.error,
      });
    } else if (result?.ok) {
        // The signIn was successful, but we don't know if a password change is required yet.
        // next-auth session is not immediately available, so we force a page reload.
        // The logic in `/` or `/dashboard/layout.tsx` will then correctly redirect.
        window.location.href = callbackUrl;
    }
  };
  
  const isLocked = lockoutTimeLeft !== null && lockoutTimeLeft > 0;
  const minutes = Math.floor(lockoutTimeLeft! / 60);
  const seconds = lockoutTimeLeft! % 60;


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/20">
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
          <div className="mb-4 flex justify-center">
            <Logo layout="vertical" />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLocked && (
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Account Locked</AlertTitle>
              <AlertDescription>
                Too many failed login attempts. Please try again in 
                <span className="font-bold ml-1">
                    {minutes > 0 && `${minutes}m `}{seconds > 0 && `${seconds}s`}
                </span>.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <fieldset disabled={isLocked || loading} className="flex flex-col gap-4">
                <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="email">Email</Label>
                </div>
                <Input
                    id="email"
                    type="email"
                    placeholder="yourEmail@example.com"
                    {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                    <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    {...register('password')}
                    />
                    <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                    </Button>
                </div>
                {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
                </div>
                <Button type="submit" className="w-full" disabled={isLocked || loading}>
                {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                )}
                </Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
