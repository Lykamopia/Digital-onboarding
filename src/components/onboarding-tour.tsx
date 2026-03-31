
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { completeOnboardingTour } from '@/app/actions/memo';
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
    hideNext?: boolean;
};

const tourSteps: TourStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to NIB Onboarding!',
        description: "This platform serves as NIB's dedicated Customer Onboarding Middleware. Let's take a quick tour of your new workspace.",
        target: 'body',
        path: '/dashboard/customer-onboarding',
        nextPath: '/dashboard/profile',
    },
    {
        id: 'profile-intro',
        title: 'Your Profile Settings',
        description: 'Manage your account details and security preferences here.',
        target: '#profile-avatar-upload-trigger',
        path: '/dashboard/profile',
    },
    {
        id: 'profile-save',
        title: 'Stay Updated',
        description: "Keep your profile information current to ensure accurate activity logging in the onboarding pipeline.",
        target: '#profile-save-button',
        path: '/dashboard/profile',
        nextPath: '/dashboard/customer-onboarding',
    },
    {
        id: 'onboarding-status',
        title: 'Onboarding Status',
        description: "This is your main dashboard where you can track the progress of all automated customer onboarding requests.",
        target: '#dashboard-content',
        path: '/dashboard/customer-onboarding',
    },
    {
        id: 'onboarding-review',
        title: 'Onboarding Pipeline',
        description: 'Review and manage the queue of pending customer requests before they are forwarded to the core banking system.',
        target: 'a[href="/dashboard/customer-onboarding/review"]',
        path: '/dashboard/customer-onboarding',
        requireSidebarClosed: true,
    },
    {
        id: 'admin-management',
        title: 'Admin Controls',
        description: 'Administrators can manage users, roles, and organizational structures here.',
        target: 'a[href="/dashboard/admin"]',
        path: '/dashboard/customer-onboarding',
        requireSidebarClosed: true,
    },
    {
        id: 'tour-finish',
        title: "All Set!",
        description: "You've explored the NIB Onboarding Middleware. You can now start managing the onboarding pipeline.",
        target: 'body',
        path: '/dashboard/customer-onboarding',
    }
];

const TourOverlay = ({ targetRect, isWelcomeStep }: { targetRect: DOMRect | null; isWelcomeStep: boolean }) => {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When it's the welcome step or no target, show a full-screen overlay
  if (isWelcomeStep || !targetRect || windowSize.width === 0) {
    return <motion.div key="welcome-overlay" className="fixed inset-0 z-[9997] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />;
  }

  const { top, left, width, height } = targetRect;
  const padding = 6;

  const overlays = [
    // Top overlay
    { key: 'top', top: 0, left: 0, width: '100%', height: Math.max(0, top - padding) },
    // Bottom overlay
    { key: 'bottom', top: Math.max(0, top + height + padding), left: 0, width: '100%', bottom: 0 },
    // Left overlay
    { key: 'left', top: Math.max(0, top - padding), left: 0, width: Math.max(0, left - padding), height: height + padding * 2 },
    // Right overlay
    { key: 'right', top: Math.max(0, top - padding), left: 0, right: 0, height: height + padding * 2, transform: `translateX(${left + width + padding}px)` },
  ];

  return (
    <>
      {overlays.map((style) => (
        <motion.div
          key={style.key}
          className="fixed z-[9997] bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={style}
        />
      ))}
    </>
  );
};

export function OnboardingTour() {
    const [stepIndex, setStepIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [highlighterStyle, setHighlighterStyle] = useState<React.CSSProperties>({});
    const [isSuppressed, setIsSuppressed] = useState(false);

    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { state: sidebarState, setOpen: setSidebarOpen } = useSidebar();
    
    const currentStep = useMemo(() => tourSteps[stepIndex], [stepIndex]);

    const popupRef = useRef<HTMLDivElement>(null);
    const [popupPosition, setPopupPosition] = useState<React.CSSProperties>({});

    const handleFinish = useCallback(async () => {
        setIsVisible(false);
        await completeOnboardingTour();
        toast.success("Ready to Go!", {
            description: "You're all set to use NIB Onboarding.",
        });
        router.push('/dashboard/customer-onboarding');
    }, [router]);

    const handleNext = useCallback(() => {
        if (currentStep.nextPath) {
            router.push(currentStep.nextPath);
        }
        if (stepIndex < tourSteps.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            handleFinish();
        }
    }, [currentStep, stepIndex, router, handleFinish]);

    const handlePrev = useCallback(() => {
        if (stepIndex > 0) {
            const prevStep = tourSteps[stepIndex - 1];
            if (prevStep.path !== pathname) {
                router.push(prevStep.path);
            }
            setStepIndex(stepIndex - 1);
        }
    }, [stepIndex, pathname, router]);

    const updateTarget = useCallback(() => {
        const POLLING_INTERVAL = 100;
        const MAX_ATTEMPTS = 50; // 5-second timeout
        let attempts = 0;

        const intervalId = setInterval(() => {
            let targetElement = document.querySelector(currentStep.target) as HTMLElement;

            if (targetElement) {
                clearInterval(intervalId);

                targetElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                
                // Use a timeout to allow the scroll to complete
                setTimeout(() => {
                    const newRect = targetElement.getBoundingClientRect();
                    setTargetRect(newRect);
                    const borderRadius = window.getComputedStyle(targetElement).borderRadius;
                    setHighlighterStyle({
                        width: `${newRect.width + 12}px`,
                        height: `${newRect.height + 12}px`,
                        top: `${newRect.top - 6}px`,
                        left: `${newRect.left - 6}px`,
                        borderRadius: `calc(${borderRadius} + 6px)`,
                    });
                }, 300); // Increased delay for smooth scroll

            } else {
                attempts++;
                if (attempts > MAX_ATTEMPTS) {
                    clearInterval(intervalId);
                    setTargetRect(null);
                    console.warn(`Onboarding tour: Could not find target element "${currentStep.target}" for step "${currentStep.id}".`);
                }
            }
        }, POLLING_INTERVAL);

        return () => clearInterval(intervalId); // Cleanup function
    }, [currentStep.target, currentStep.id]);
    
    const adjustedDescription = currentStep.description;

    const calculateAndSetPosition = useCallback(() => {
        const isWelcomeStep = currentStep.target === 'body';
        const VIEWPORT_PADDING = 16;

        if (isWelcomeStep || !targetRect || !popupRef.current) {
            setPopupPosition({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            });
            return;
        }

        const { innerWidth: winWidth, innerHeight: winHeight } = window;
        const popupHeight = popupRef.current.offsetHeight;
        const popupWidth = popupRef.current.offsetWidth;

        let top;
        let left;
        
        const canFitBelow = targetRect.bottom + popupHeight + VIEWPORT_PADDING < winHeight;
        const canFitAbove = targetRect.top - popupHeight - VIEWPORT_PADDING > 0;

        if (canFitBelow) {
            top = targetRect.bottom + 8;
        } else if (canFitAbove) {
            top = targetRect.top - popupHeight - 8;
        } else {
            // Fallback: Position in the vertical center of the screen
            top = (winHeight - popupHeight) / 2;
        }

        // Center horizontally and clamp
        left = targetRect.left + targetRect.width / 2 - popupWidth / 2;
        left = Math.max(VIEWPORT_PADDING, left);
        left = Math.min(left, winWidth - popupWidth - VIEWPORT_PADDING);

        // Finally, ensure the final `top` is also within the viewport
        top = Math.max(VIEWPORT_PADDING, top);
        top = Math.min(top, winHeight - popupHeight - VIEWPORT_PADDING);

        setPopupPosition({ top: `${top}px`, left: `${left}px`, transform: 'none' });

    }, [currentStep.target, targetRect]);


    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Handle search params for deep linking if necessary
    }, [searchParams]);

    useEffect(() => {
        // Handle path transitions if necessary
    }, [pathname]);
    
    useEffect(() => {
        const handleDialogState = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (currentStep && currentStep.id === 'profile-signature') {
                setIsSuppressed(customEvent.detail.open);
            }
        };
        window.addEventListener('onboarding-dialog-state', handleDialogState as EventListener);
        return () => window.removeEventListener('onboarding-dialog-state', handleDialogState as EventListener);
    }, [currentStep]);


    useEffect(() => {
        if (!isVisible || !currentStep) return;

        if (currentStep.requireSidebarClosed && sidebarState === 'expanded') {
            setSidebarOpen(false);
        }

        const cleanupPolling = updateTarget();
        const onResize = () => {
            updateTarget();
        };
        
        window.addEventListener('resize', onResize);

        return () => {
            cleanupPolling();
            window.removeEventListener('resize', onResize);
        };
    }, [stepIndex, pathname, isVisible, currentStep, updateTarget, sidebarState, setSidebarOpen]);

    useEffect(() => {
        if (isVisible && currentStep) {
            const timer = setTimeout(calculateAndSetPosition, 100);
            return () => clearTimeout(timer);
        }
    }, [isVisible, currentStep, targetRect, calculateAndSetPosition]);

    if (isSuppressed || !isVisible || !currentStep || (!targetRect && currentStep.target !== 'body') || currentStep.path !== pathname) {
        return null;
    }

    const isWelcomeStep = currentStep.target === 'body';

    return (
        <AnimatePresence>
            <TourOverlay key="tour-overlay" targetRect={targetRect} isWelcomeStep={isWelcomeStep} />
            
            {!isWelcomeStep && targetRect && (
                 <motion.div
                    key="highlighter"
                    layout
                    className="onboarding-highlight onboarding-pulse"
                    style={highlighterStyle}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, opacity: { duration: 0.2 } }}
                />
            )}

            <motion.div
                key={`popup-${stepIndex}`}
                ref={popupRef}
                layout="position"
                className="fixed z-[9999] w-80 rounded-lg border bg-card text-card-foreground shadow-xl"
                style={popupPosition}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    layout: {
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                    },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 },
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
                    <p className="mt-2 text-sm text-muted-foreground">{adjustedDescription}</p>
                </div>
                <div className="flex items-center justify-between border-t bg-muted/50 p-4">
                    <span className="text-xs text-muted-foreground">
                        Step {stepIndex + 1} of {tourSteps.length}
                    </span>
                    <div className="flex gap-2">
                        {stepIndex > 0 && (
                            <Button variant="outline" size="sm" onClick={handlePrev}>Previous</Button>
                        )}
                        {!currentStep.hideNext && (
                            <Button size="sm" onClick={handleNext}>
                                {stepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
