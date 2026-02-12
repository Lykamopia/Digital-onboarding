
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
    // Step 1: Welcome (On Inbox)
    {
        id: 'welcome',
        title: 'Welcome to Nib Memo!',
        description: "Let's take a quick tour to get you set up. First, we'll head over to your profile to complete your setup.",
        target: 'body',
        path: '/dashboard/inbox',
        nextPath: '/dashboard/profile',
    },
    // --- PROFILE ---
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
        id: 'profile-save',
        title: 'Save Your Changes',
        description: "Whenever you make changes to your profile, click this button to save them. Feel free to try it now if you've uploaded an avatar or signature!",
        target: '#profile-save-button',
        path: '/dashboard/profile',
    },
    {
        id: 'profile-done',
        title: "Profile Complete!",
        description: "Great! Your profile is set up. Let's head back to the inbox to see how it works.",
        target: '#user-nav-trigger',
        path: '/dashboard/profile',
        requireSidebarClosed: true,
        nextPath: '/dashboard/inbox',
    },
    // --- INBOX ---
    {
        id: 'inbox-list',
        title: 'Your Inbox',
        description: "This is your inbox, where all memos sent to you will appear. Let's explore the layout.",
        target: '#dashboard-grid',
        path: '/dashboard/inbox',
    },
    {
        id: 'inbox-filters',
        title: 'Filter & Search',
        description: 'You can use these controls to search, filter by date, category, or labels to quickly find what you need.',
        target: '#memo-filters-container',
        path: '/dashboard/inbox',
    },
    {
        id: 'inbox-item',
        title: 'Reading a Memo',
        description: 'Click on any memo in this list to open it. If there is a sample memo, click on it now to continue the tour.',
        target: '[data-testid="memo-item"]',
        path: '/dashboard/inbox',
    },
    // --- MEMO DISPLAY ---
    {
        id: 'memo-display-header',
        title: 'Memo Details',
        description: 'At the top, you can see all the important details: sender, recipients, subject, and attachments.',
        target: '#memo-display-header',
        path: '/dashboard/inbox',
    },
    {
        id: 'memo-display-activity',
        title: 'Activity History',
        description: 'This timeline shows every action taken on the memo, providing a complete audit trail.',
        target: '#memo-activity-history',
        path: '/dashboard/inbox',
    },
    {
        id: 'memo-compose-link',
        title: 'Ready to Compose?',
        description: "Now let's see how to write your own memo. Click on the highlighted 'New Memo' button to continue.",
        target: 'a[href="/dashboard/new"]',
        path: '/dashboard/inbox',
        requireSidebarClosed: true,
        hideNext: true,
    },
    // --- COMPOSE PAGE ---
    {
        id: 'compose-recipients',
        title: 'Add Recipients',
        description: "Start by selecting who the memo is for in the 'To' and 'CC' fields.",
        target: '#recipient-selector-to',
        path: '/dashboard/new',
    },
    {
        id: 'compose-subject',
        title: 'Enter a Subject',
        description: 'A clear and concise subject helps recipients understand the memo at a glance.',
        target: '#compose-subject-input',
        path: '/dashboard/new',
    },
    {
        id: 'compose-body',
        title: 'Write Your Memo',
        description: 'Use the rich text editor to compose your message. You can use templates to get started quickly!',
        target: '#memo-editor-container',
        path: '/dashboard/new',
    },
    {
        id: 'compose-actions',
        title: 'Send or Preview',
        description: "Once you're done, you can preview how your memo will look or send it off.",
        target: '#compose-actions-container',
        path: '/dashboard/new',
    },
    // --- FINISH ---
    {
        id: 'tour-finish',
        title: "You're a Pro!",
        description: "You've learned the basics of Nib Memo. You can now close this tour and start exploring on your own.",
        target: 'body',
        path: '/dashboard/new',
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
    { key: 'right', top: Math.max(0, top - padding), left: Math.max(0, left + width + padding), right: 0, height: height + padding * 2 },
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
        toast.success("Onboarding Complete!", {
            description: "You're all set to use Nib Memo.",
        });
        router.push('/dashboard/inbox');
    }, [router]);

    const handleNext = useCallback(() => {
        if (currentStep.id === 'inbox-item') {
            const memoItemExists = document.querySelector('[data-testid="memo-item"]');
            if (!memoItemExists) {
                const composeStepIndex = tourSteps.findIndex(step => step.id === 'memo-compose-link');
                if (composeStepIndex !== -1) {
                    setStepIndex(composeStepIndex);
                    return;
                }
            }
        }

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

            if (currentStep.id === 'inbox-item' && !targetElement) {
                targetElement = document.querySelector('[data-testid="empty-state"]') as HTMLElement;
            }

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
    
    const adjustedDescription = useMemo(() => {
        if (currentStep.id === 'inbox-item') {
            if (typeof document !== 'undefined') {
                const memoItemExists = document.querySelector('[data-testid="memo-item"]');
                if (!memoItemExists) {
                    return "Your inbox is currently empty. Memos you receive will appear here. Let's move on to creating one!";
                }
            }
        }
        return currentStep.description;
    }, [currentStep.id, currentStep.description]);

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

        // Does it fit below?
        if (targetRect.bottom + popupHeight + VIEWPORT_PADDING < winHeight) {
            top = targetRect.bottom + 8;
        } 
        // Does it fit above?
        else if (targetRect.top - popupHeight - VIEWPORT_PADDING > 0) {
            top = targetRect.top - popupHeight - 8;
        } 
        // If neither, fallback to centering
        else {
            setPopupPosition({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            });
            return;
        }

        // Center horizontally and clamp
        left = targetRect.left + targetRect.width / 2 - popupWidth / 2;
        left = Math.max(VIEWPORT_PADDING, left);
        left = Math.min(left, winWidth - popupWidth - VIEWPORT_PADDING);

        setPopupPosition({ top: `${top}px`, left: `${left}px`, transform: 'none' });

    }, [currentStep.target, targetRect]);


    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const memoId = searchParams.get('id');
        if (currentStep.id === 'inbox-item' && memoId) {
            handleNext();
        }
    }, [searchParams, currentStep.id, handleNext]);

    useEffect(() => {
        if (currentStep.id === 'memo-compose-link' && pathname === '/dashboard/new') {
            handleNext();
        }
    }, [pathname, currentStep.id, handleNext]);
    
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
                    stiffness: 300,
                    damping: 25,
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
