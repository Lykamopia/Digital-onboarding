
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
        id: 'memo-display-actions',
        title: 'Memo Actions',
        description: 'Below the memo content, you can find actions like Acknowledge, Reply, or Assign.',
        target: '#memo-display-actions',
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
        description: "Now let's see how to write your own memo. Click on the 'New Memo' button to continue.",
        target: 'a[href="/dashboard/new"]',
        path: '/dashboard/inbox',
        requireSidebarClosed: true,
        nextPath: '/dashboard/new',
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
    return <motion.div className="fixed inset-0 z-[9997] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />;
  }

  const { top, left, width, height } = targetRect;
  const padding = 6;

  const overlays = [
    // Top overlay
    { top: 0, left: 0, width: '100%', height: Math.max(0, top - padding) },
    // Bottom overlay
    { top: Math.max(0, top + height + padding), left: 0, width: '100%', bottom: 0 },
    // Left overlay
    { top: Math.max(0, top - padding), left: 0, width: Math.max(0, left - padding), height: height + padding * 2 },
    // Right overlay
    { top: Math.max(0, top - padding), left: Math.max(0, left + width + padding), right: 0, height: height + padding * 2 },
  ];

  return (
    <>
      {overlays.map((style, i) => (
        <motion.div
          key={i}
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
    const [highlighterStyle, setHighlighterStyle] = useState({});

    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { state: sidebarState, setOpen: setSidebarOpen } = useSidebar();
    
    const currentStep = useMemo(() => tourSteps[stepIndex], [stepIndex]);

    const handleFinish = useCallback(async () => {
        setIsVisible(false);
        await completeOnboardingTour();
        toast.success("Onboarding Complete!", {
            description: "You're all set to use Nib Memo.",
        });
    }, []);

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
        let targetElement = document.querySelector(currentStep.target);
        
        if (currentStep.id === 'inbox-item' && !targetElement) {
            targetElement = document.querySelector('[data-testid="empty-state"]');
        }

        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            const isFullyInView = 
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth;
            
            if (!isFullyInView) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // A timeout to allow scroll animation to finish before updating position
            setTimeout(() => {
                const newRect = targetElement!.getBoundingClientRect();
                setTargetRect(newRect);
                const borderRadius = window.getComputedStyle(targetElement!).borderRadius;
                setHighlighterStyle({
                    width: `${newRect.width + 12}px`,
                    height: `${newRect.height + 12}px`,
                    top: `${newRect.top - 6}px`,
                    left: `${newRect.left - 6}px`,
                    borderRadius: `calc(${borderRadius} + 6px)`,
                });
            }, isFullyInView ? 0 : 300); // No delay if already in view
        } else {
            setTargetRect(null);
        }
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
        if (!isVisible || !currentStep) return;

        if (currentStep.requireSidebarClosed && sidebarState === 'expanded') {
            setSidebarOpen(false);
        }

        const onResize = () => updateTarget();
        const timer = setTimeout(updateTarget, 300);
        window.addEventListener('resize', onResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', onResize);
        };
    }, [stepIndex, pathname, isVisible, currentStep, updateTarget, sidebarState, setSidebarOpen]);

    if (!isVisible || !currentStep || (!targetRect && currentStep.target !== 'body') || currentStep.path !== pathname) {
        return null;
    }

    const isWelcomeStep = currentStep.target === 'body';

    const getPopupPosition = () => {
        if (isWelcomeStep || !targetRect) {
            return {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const isTargetInBottomHalf = targetRect.top + targetRect.height / 2 > window.innerHeight / 2;
        
        let top: string | number = 'auto';
        let bottom: string | number = 'auto';
        
        if (isTargetInBottomHalf) {
            bottom = window.innerHeight - targetRect.top + 20;
        } else {
            top = targetRect.bottom + 20;
        }

        const baseLeft = targetRect.left + targetRect.width / 2 - 160; // 160 is half popup width
        let left: number | string = Math.max(20, baseLeft);
        if (left + 320 > window.innerWidth - 20) {
            left = window.innerWidth - 320 - 20;
        }

        return { top, bottom, left };
    };
    const popupPositionStyle = getPopupPosition();

    return (
        <AnimatePresence>
            <TourOverlay targetRect={targetRect} isWelcomeStep={isWelcomeStep} />
            
            {!isWelcomeStep && targetRect && (
                 <motion.div
                    key="highlighter"
                    className="onboarding-highlight onboarding-pulse"
                    initial={{ opacity: 0, ...highlighterStyle }}
                    animate={{ opacity: 1, ...highlighterStyle }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                />
            )}

            <motion.div
                key={`popup-${stepIndex}`}
                className="fixed z-[9999] w-80 rounded-lg border bg-card text-card-foreground shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={popupPositionStyle}
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
                        <Button size="sm" onClick={handleNext}>
                            {stepIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
