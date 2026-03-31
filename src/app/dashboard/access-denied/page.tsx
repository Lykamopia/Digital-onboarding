
'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AccessDeniedIllustration } from '@/components/access-denied-illustration';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
    },
  },
};

export default function AccessDeniedPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden bg-background p-4 text-center">
        {/* Animated background shapes */}
        <motion.div 
            className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-destructive/5 rounded-full" 
            animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
            className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 bg-primary/5 rounded-full" 
            animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <svg
            viewBox="0 0 1024 1024"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
            aria-hidden="true"
        >
            <circle cx={512} cy={512} r={512} fill="url(#gradient-denied)" fillOpacity="0.3" />
            <defs>
            <radialGradient id="gradient-denied">
                <stop stopColor="hsl(var(--destructive))" />
                <stop offset={1} stopColor="hsl(var(--primary))" />
            </radialGradient>
            </defs>
        </svg>

        <motion.div
            className="z-10 flex flex-col items-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={itemVariants}>
                <AccessDeniedIllustration />
            </motion.div>
            
            <motion.h1 
                className="mt-8 text-4xl font-bold tracking-tight text-destructive sm:text-6xl"
                variants={itemVariants}
            >
                Access Denied
            </motion.h1>

            <motion.p 
                className="mt-4 max-w-md text-lg text-muted-foreground"
                variants={itemVariants}
            >
                You do not have the necessary permissions to view this page. If you believe this is an error, please contact your administrator.
            </motion.p>
            
            <motion.div
                className="mt-10"
                variants={itemVariants}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <Link href="/dashboard/customer-onboarding">
                    <Button size="lg" className="px-8 shadow-lg shadow-primary/20">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Return to Dashboard
                    </Button>
                </Link>
            </motion.div>
        </motion.div>
    </div>
  );
}
