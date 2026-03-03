
'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Building2, Sparkles } from "lucide-react";
import Image from "next/image";
import { AnimatedContent } from "@/components/animated-content";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

export default function DashboardLandingPage() {
  return (
    <AnimatedContent className="max-w-6xl mx-auto py-12 px-4 md:px-0 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      {/* Cards Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full mb-24"
      >
        {/* School Management System */}
        <motion.div variants={itemVariants} className="group">
          <Card className="overflow-hidden border-none shadow-2xl glass-surface h-full transform transition-all duration-500 hover:scale-[1.02]">
            <div className="relative h-80 w-full overflow-hidden">
              <Image 
                src="/Nibtera Asquala.jpeg" 
                alt="Nibtera Asquala - School Management System" 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-8 right-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-accent/90 rounded-lg">
                    <GraduationCap className="h-8 w-8 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold tracking-tight">Nibtera Asquala</h3>
                    <p className="text-accent text-sm font-semibold uppercase tracking-widest">School Management System</p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-8 bg-card/40 backdrop-blur-md">
              <p className="text-muted-foreground leading-relaxed text-lg italic text-center">
                Automated student grading, digital attendance management, and parent-teacher communication portals.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Building Management System */}
        <motion.div variants={itemVariants} className="group">
          <Card className="overflow-hidden border-none shadow-2xl glass-surface h-full transform transition-all duration-500 hover:scale-[1.02]">
            <div className="relative h-80 w-full overflow-hidden">
              <Image 
                src="/NibBuilding.jpeg" 
                alt="Nib Building - Facility Management System" 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-8 right-6">
                <div className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-primary/90 rounded-lg">
                    <Building2 className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold tracking-tight">Nib Building</h3>
                    <p className="text-primary text-sm font-semibold uppercase tracking-widest">Building Management System</p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-8 bg-card/40 backdrop-blur-md">
              <p className="text-muted-foreground leading-relaxed text-lg italic text-center">
                Smart IoT sensor integration, facility maintenance scheduling, and real-time utility consumption analytics.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Coming Soon Section */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 1 }}
        className="text-center space-y-8 flex flex-col items-center"
      >
        <div className="relative">
            <motion.h2 
                className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic"
                animate={{ 
                    backgroundImage: [
                        "linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))",
                        "linear-gradient(to right, hsl(var(--accent)), hsl(var(--primary)))",
                        "linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))"
                    ] 
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                style={{ 
                    WebkitBackgroundClip: "text", 
                    WebkitTextFillColor: "transparent",
                    backgroundSize: "200% auto"
                }}
            >
                Dashboard Features
            </motion.h2>
            <motion.div 
                className="absolute -top-10 -right-10 hidden md:block"
                animate={{ rotate: 360, scale: [1, 1.3, 1] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
                <Sparkles className="h-16 w-16 text-accent opacity-40" />
            </motion.div>
        </div>
        
        <div className="space-y-4">
            <motion.p 
                className="text-2xl md:text-4xl text-muted-foreground font-bold tracking-[0.2em] uppercase"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.98, 1, 0.98] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
                Coming Soon
            </motion.p>
            <motion.div 
                className="h-1.5 w-48 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent rounded-full"
                animate={{ width: [0, 192, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
        </div>
      </motion.div>
    </AnimatedContent>
  );
}
