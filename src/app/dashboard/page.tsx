
'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  ArrowRight,
  Cpu,
  Building2,
  GraduationCap,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedContent } from "@/components/animated-content";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
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
    <AnimatedContent className="max-w-6xl mx-auto space-y-16 pb-20 px-4 md:px-0">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/95 to-primary text-primary-foreground shadow-2xl"
      >
        <div className="absolute inset-0 opacity-20">
          <Image 
            src="https://picsum.photos/seed/bank-hero/1200/600" 
            alt="Bank background" 
            fill 
            className="object-cover"
            data-ai-hint="banking abstract"
          />
        </div>
        <div className="relative z-10 px-8 py-16 md:py-24 md:px-16 flex flex-col items-center text-center space-y-6">
          <Badge variant="secondary" className="px-4 py-1 text-sm font-semibold tracking-wider uppercase bg-accent text-accent-foreground animate-pulse border-none">
            Ecosystem Preview
          </Badge>
          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Expanding the <br /> <span className="text-accent">Nib Digital</span> Frontier
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-primary-foreground/80 leading-relaxed">
            Beyond memorandums, we are building a integrated enterprise ecosystem to streamline every aspect of organizational management.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link href="/dashboard/inbox">
              <Button size="lg" variant="secondary" className="font-bold text-primary px-8 hover:scale-105 transition-transform">
                Go to Inbox <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Featured Systems Section */}
      <div className="space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Nib Enterprise Solutions</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Experience the next generation of specialized management platforms, coming soon to your unified dashboard.
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {/* School Management System */}
          <motion.div variants={itemVariants} className="group">
            <Card className="overflow-hidden border-none shadow-xl glass-surface h-full">
              <div className="relative h-64 w-full overflow-hidden">
                <Image 
                  src="/Nibtera Asquala.jpeg" 
                  alt="Nibtera Asquala - School Management System" 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <div className="flex items-center gap-2 text-white">
                    <GraduationCap className="h-6 w-6 text-accent" />
                    <h3 className="text-2xl font-bold">Nibtera Asquala</h3>
                  </div>
                </div>
              </div>
              <CardContent className="p-8 space-y-4">
                <Badge variant="outline" className="border-accent text-accent">School Management System</Badge>
                <p className="text-muted-foreground leading-relaxed">
                  A comprehensive educational platform designed to digitalize academic records, student tracking, and institutional administration. Streamlining the future of learning.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-accent" /> Automated Student Grading</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-accent" /> Digital Attendance Management</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-accent" /> Parent-Teacher Communication Portal</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* Building Management System */}
          <motion.div variants={itemVariants} className="group">
            <Card className="overflow-hidden border-none shadow-xl glass-surface h-full">
              <div className="relative h-64 w-full overflow-hidden">
                <Image 
                  src="/NibBuilding.jpeg" 
                  alt="Nib Building - Facility Management System" 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-6 right-6">
                  <div className="flex items-center gap-2 text-white">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h3 className="text-2xl font-bold">Nib Building</h3>
                  </div>
                </div>
              </div>
              <CardContent className="p-8 space-y-4">
                <Badge variant="outline" className="border-primary text-primary">Building Management System</Badge>
                <p className="text-muted-foreground leading-relaxed">
                  Intelligent facility operations and asset tracking. Monitor infrastructure health, manage utilities, and optimize corporate real estate efficiency in real-time.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" /> Smart IoT Sensor Integration</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" /> Facility Maintenance Scheduling</li>
                  <li className="flex items-center gap-2"><Sparkles className="h-3 w-3 text-primary" /> Real-time Utility Consumption Analytics</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-muted/30 rounded-[2.5rem] p-8 md:p-12 border border-border/50 backdrop-blur-sm"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="space-y-4 text-center md:text-left max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Ready for the Next Evolution of Corporate Systems?</h2>
            <p className="text-muted-foreground">Join the internal pilot program for our new management modules and shape the future of Nib Technology.</p>
            <Button className="font-bold rounded-full px-8">Register for Early Access</Button>
          </div>
          <div className="grid grid-cols-2 gap-8 w-full md:w-auto">
            <div className="space-y-1 text-center md:text-left">
              <p className="text-4xl font-extrabold text-primary">99.9%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Uptime Target</p>
            </div>
            <div className="space-y-1 text-center md:text-left">
              <p className="text-4xl font-extrabold text-primary">AES-256</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Encryption</p>
            </div>
            <div className="space-y-1 text-center md:text-left">
              <p className="text-4xl font-extrabold text-primary">24/7</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expert Support</p>
            </div>
            <div className="space-y-1 text-center md:text-left">
              <p className="text-4xl font-extrabold text-primary">10k+</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Users</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer Branding */}
      <footer className="text-center space-y-4 pt-12 border-t border-border/50">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Cpu className="h-5 w-5" />
          <span className="font-bold tracking-tighter">POWERED BY NIB TECHNOLOGY GROUP</span>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest opacity-50">
          © 2026 Nib International Bank. All ecosystem modules subject to departmental compliance.
        </p>
      </footer>
    </AnimatedContent>
  );
}
