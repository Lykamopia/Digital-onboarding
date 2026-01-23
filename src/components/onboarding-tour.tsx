
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { completeOnboardingTour } from '@/app/actions/memo';
import Logo from './logo';
import { cn } from '@/lib/utils';
import { useSidebar } from './ui/sidebar';
import { toast } from 'sonner';

type TourStep = {
    id: string;
    title: string;
    description: string;
    target: string;
    path: string;
    nextPath?: string;
    requireSidebarClosed?: boolean;
};

const tourSteps: TourStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Nib Memo!',
        description: "Let's take a quick tour to get you set up. First, we'll head over to your profile to complete your setup.",
        target: 'body',
        path: '/dashboard/inbox',
        nextPath: '/dashboard/profile',
    },
    {
        id: 'profile-intro',
        title: 'Your Profile Page',
        description: 'Here you can manage your personal information, signature, and security settings.',
        target: '#profile-avatar-upload-trigger',
        path: '/dashboard/profile',
    },
    {
        id: 'profile-avatar',
        title: 'Upload Your Avatar',
        description: 'A profile picture helps your colleagues recognize you. Click the camera icon to upload one!',
        target: '#profile-avatar-upload-trigger',
        path: '/dashboard/profile',
    },
    {
        id: 'profile-signature',
        title: 'Set Your Signature',
        description: 'Your digital signature will be used to acknowledge memos. You can draw it or upload an image of your signature.',
        target: '#signature-edit-trigger',
        path: '/dashboard/profile',
    },
    {
        id: 'tour-finish',
        title: "You're All Set!",
        description: "You've completed the basic setup and can now start sending and receiving memos. You can always find your way back to your profile from the user menu.",
        target: '#user-nav-trigger',
        path: '/dashboard/profile',
        requireSidebarClosed: true
    }
];

export function OnboardingTour() {
    const [stepIndex, setStepIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [highlighterStyle, setHighlighterStyle] = useState({});

    const pathname = usePathname();
    const router = useRouter();
    const { state: sidebarState, setOpen: setSidebarOpen } = useSidebar();
    
    const currentStep = useMemo(() => tourSteps[stepIndex], [stepIndex]);

    const handleNext = () => {
        if (stepIndex < tourSteps.length - 1) {
            const nextStep = tourSteps[stepIndex + 1];
            if (nextStep.path !== pathname) {
                router.push(nextStep.path);
            }
            setStepIndex(stepIndex + 1);
        } else {
            handleFinish();
        }
    };

    const handlePrev = () => {
        if (stepIndex > 0) {
            const prevStep = tourSteps[stepIndex - 1];
            if (prevStep.path !== pathname) {
                router.push(prevStep.path);
            }
            setStepIndex(stepIndex - 1);
        }
    };

    const handleFinish = async () => {
        setIsVisible(false);
        await completeOnboardingTour();
        toast.success("Onboarding Complete!", {
            description: "You're all set to use Nib Memo.",
        });
    };

    const updateTarget = useCallback(() => {
        const targetElement = document.querySelector(currentStep.target);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            setTargetRect(rect);
            const borderRadius = window.getComputedStyle(targetElement).borderRadius;
            setHighlighterStyle({
                width: `${rect.width + 12}px`,
                height: `${rect.height + 12}px`,
                top: `${rect.top - 6}px`,
                left: `${rect.left - 6}px`,
                borderRadius: `calc(${borderRadius} + 6px)`,
            });
        } else {
            setTargetRect(null);
        }
    }, [currentStep.target]);

    useEffect(() => {
        // Initial visibility delay
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isVisible || !currentStep) return;

        // If step requires sidebar to be closed, close it
        if (currentStep.requireSidebarClosed && sidebarState === 'expanded') {
            setSidebarOpen(false);
        }

        const onResize = () => updateTarget();
        
        // Wait for potential layout shifts or navigation
        const timer = setTimeout(updateTarget, 300);
        window.addEventListener('resize', onResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, [stepIndex, pathname, isVisible, currentStep, updateTarget, sidebarState, setSidebarOpen]);

    if (!isVisible || !currentStep || !targetRect || currentStep.path !== pathname) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[9997] bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            />
            
            <motion.div
                className={cn("onboarding-highlight", currentStep.target !== 'body' && 'onboarding-pulse')}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, ...highlighterStyle }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            />

            <motion.div
                className="fixed z-[9999] w-80 rounded-lg border bg-card text-card-foreground shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    top: targetRect.bottom + 20,
                    left: targetRect.left + targetRect.width / 2 - 160,
                    // Basic boundary detection
                    ...(targetRect.bottom + 300 > window.innerHeight && { bottom: window.innerHeight - targetRect.top + 20, top: 'auto' }),
                    ...(targetRect.left + targetRect.width / 2 + 160 > window.innerWidth && { right: 20, left: 'auto' }),
                    ...(targetRect.left + targetRect.width / 2 - 160 < 0 && { left: 20 }),
                }}
            >
                <div className="p-4">
                    <div className="flex items-start justify-between">
                         <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                <Lightbulb className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">{currentStep.title}</h3>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleFinish}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{currentStep.description}</p>
                </div>
                <div className="flex items-center justify-between border-t bg-muted/50 p-4">
                    <span className="text-xs text-muted-foreground">
                        Step {stepIndex + 1} of {tourSteps.length}
                    </span>
                    <div className="flex gap-2">
                        {stepIndex > 0 && (
                            <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>
                        )}
                        <Button size="sm" onClick={handleNext}>
                            {stepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
