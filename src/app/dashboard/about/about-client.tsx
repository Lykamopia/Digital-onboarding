'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Mail, Share2, Fingerprint, Lock, Search, Users } from "lucide-react";
import Logo from "@/components/logo";
import { AboutIllustration } from "@/components/about-illustration";
import { motion } from 'framer-motion';
import { AnimatedContent } from "@/components/animated-content";

const featureList = [
    {
        icon: <Mail className="h-6 w-6 text-primary" />,
        title: "Centralized Memo Management",
        description: "Organize all your internal communications in one place with powerful inbox, sent, and draft views."
    },
    {
        icon: <Share2 className="h-6 w-6 text-primary" />,
        title: "Advanced Memo Workflows",
        description: "Streamline processes with features like replying, assigning, and CC'ing memos to relevant parties."
    },
    {
        icon: <Fingerprint className="h-6 w-6 text-primary" />,
        title: "Digital Acknowledgements",
        description: "Track memo receipt and compliance with secure digital signature or badge-based acknowledgements."
    },
    {
        icon: <Lock className="h-6 w-6 text-primary" />,
        title: "Secure Authentication",
        description: "Protect your sensitive information with a robust login system, password policies, and account lockout features."
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: "Role-Based Access Control",
        description: "Define custom roles and permissions to ensure users only see and do what they are authorized for."
    },
    {
        icon: <Search className="h-6 w-6 text-primary" />,
        title: "Powerful Search & Audit",
        description: "Quickly find any memo with advanced filtering and maintain a complete audit trail for compliance."
    }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export default function AboutClientPage({ appVersion }: { appVersion: string }) {
    return (
        <AnimatedContent>
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Hero Section */}
                <section className="text-center py-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <AboutIllustration />
                        <h1 className="mt-8 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                            About Nib Memo
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                            A secure, streamlined, and efficient platform for managing all your internal memorandums.
                        </p>
                    </motion.div>
                </section>

                {/* Features Section */}
                <section>
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold">Key Features</h2>
                        <p className="text-muted-foreground mt-2">Everything you need for modern internal communication.</p>
                    </div>
                    <motion.div
                        className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.2 }}
                    >
                        {featureList.map((feature, index) => (
                            <motion.div key={index} variants={itemVariants}>
                                <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                    <CardHeader className="flex flex-row items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                            {feature.icon}
                                        </div>
                                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-muted-foreground">{feature.description}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                {/* Version Section */}
                <section>
                    <motion.div 
                        className="text-center py-8"
                        initial={{ opacity: 0 }}
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Logo layout="vertical" />
                        <p className="mt-4 text-sm text-muted-foreground">
                            Version {appVersion}
                        </p>
                    </motion.div>
                </section>
            </div>
        </AnimatedContent>
    );
}
