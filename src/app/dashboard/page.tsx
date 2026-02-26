
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  ShieldCheck, 
  PieChart, 
  Smartphone, 
  ArrowRight,
  TrendingUp,
  Cpu
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AnimatedContent } from "@/components/animated-content";

export default function DashboardLandingPage() {
  return (
    <AnimatedContent className="max-w-6xl mx-auto space-y-12 pb-12 px-4 md:px-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 to-primary text-primary-foreground shadow-2xl">
        <div className="absolute inset-0 opacity-10">
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
            Coming Soon
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            The Future of <br /> Digital Banking is <span className="text-accent">Evolving</span>
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-primary-foreground/80 leading-relaxed">
            Nib Memo is expanding into a comprehensive enterprise financial ecosystem. Soon, you'll manage not just internal memos, but also corporate transfers, real-time market data, and AI-driven financial planning.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Link href="/dashboard/inbox">
              <Button size="lg" variant="secondary" className="font-bold text-primary px-8 hover:scale-105 transition-transform">
                Go to Inbox <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 hover:bg-primary-foreground/10 px-8">
              Explore Roadmap
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Upcoming Features</h2>
          <p className="text-muted-foreground">We're working hard to bring these next-generation tools to your dashboard.</p>
        </div>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-none shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardContent className="p-8 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <PieChart className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Advanced Analytics</h3>
              <p className="text-muted-foreground leading-relaxed">
                Unlock powerful insights into your team's communication efficiency and memo engagement with our new real-time data visualization engine.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-accent text-accent">Phase 2</Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">Q4 2025</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardContent className="p-8 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Enterprise Wallet</h3>
              <p className="text-muted-foreground leading-relaxed">
                Seamlessly manage corporate spending and virtual cards directly from your memo dashboard. Integrated with global payment gateways.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-primary text-primary font-bold">Secure</Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">Pending Beta</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <CardContent className="p-8 space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Mobile Banking App</h3>
              <p className="text-muted-foreground leading-relaxed">
                The full power of Nib Memo Plus in your pocket. biometric security, push notifications, and offline memo reading for on-the-go productivity.
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-blue-500 text-blue-500">Android & iOS</Badge>
                <Badge variant="secondary" className="text-[10px] uppercase">2026</Badge>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Stats Section */}
      <section className="bg-muted/30 rounded-3xl p-8 md:p-12 border border-border/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="space-y-4 text-center md:text-left max-w-md">
            <h2 className="text-3xl font-bold leading-tight">Ready for the Next Evolution of Corporate Banking?</h2>
            <p className="text-muted-foreground">Join the waitlist for the Nib Memo Plus beta program and be the first to experience the future.</p>
            <Button className="font-bold">Join the Beta Waitlist</Button>
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
      </section>

      {/* Footer Branding */}
      <footer className="text-center space-y-4 pt-12">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Cpu className="h-5 w-5" />
          <span className="font-bold tracking-tighter">POWERED BY NIB TECHNOLOGY GROUP</span>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest opacity-50">
          © 2026 Nib International Bank. All features subject to regulatory approval.
        </p>
      </footer>
    </AnimatedContent>
  );
}
