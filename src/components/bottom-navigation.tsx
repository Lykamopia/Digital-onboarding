'use client';

import { 
  Shield, User as UserIcon, 
  MoreHorizontal, Lock, ShieldAlert, Info, Users2, ClipboardCheck, Star 
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Permission, LoggedInUser } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import Logo from './logo';
import { Separator } from './ui/separator';
import { useMemo } from 'react';

interface BottomNavigationProps {
  user: LoggedInUser;
}

export function BottomNavigation({ user }: BottomNavigationProps) {
  const pathname = usePathname();

  const permissions = useMemo(() => user.role?.permissions?.split(',').map(p => p.trim()) || [], [user.role?.permissions]);
  
  const isAdmin = useMemo(() => permissions.includes('admin'), [permissions]);
  const canReviewOnboarding = useMemo(() => permissions.includes('approver_customer_onboarding') || permissions.includes('verifier_customer_onboarding') || isAdmin, [permissions, isAdmin]);
  const canSubmitOnboarding = useMemo(() => permissions.includes('verifier_customer_onboarding') || isAdmin, [permissions, isAdmin]);
  const canViewOnboarding = useMemo(() => permissions.includes('viewer_customer_onboarding'), [permissions]);

  const allNavItems = [
    // Onboarding Middleware
    { href: "/dashboard/customer-onboarding", icon: <Users2 />, label: "Status", active: pathname === '/dashboard/customer-onboarding', visible: (canSubmitOnboarding || canReviewOnboarding || canViewOnboarding) && !user.actingUser },
    { href: "/dashboard/customer-onboarding/review", icon: <ClipboardCheck />, label: "Pipeline", active: pathname.startsWith('/dashboard/customer-onboarding/review'), visible: (canReviewOnboarding || canViewOnboarding) && !user.actingUser },

    { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: !user.actingUser },
    { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: permissions.some(p => p.startsWith('manage_')) && !user.actingUser },
  ];

  const visibleNavItems = allNavItems.filter(item => item.visible);
  
  // Mobile nav usually limited to 4-5 items
  const mainItems = visibleNavItems.slice(0, 4);
  const moreItems = visibleNavItems.slice(4);

  const NavItem = ({ item }: { item: typeof allNavItems[0] }) => (
    <Link href={item.href} className="flex flex-col items-center justify-center text-center gap-1 text-xs font-medium">
      <div className={cn("relative w-8 h-8 flex items-center justify-center rounded-full transition-colors", item.active && "bg-primary/10 text-primary")}>
        {item.icon}
      </div>
      <span className={cn("text-muted-foreground", item.active && "text-primary")}>{item.label}</span>
    </Link>
  );

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-[calc(env(safe-area-inset-bottom,0)+4.5rem)] bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:hidden z-40">
        <div className="flex justify-around items-center h-full max-w-md mx-auto px-4 pb-[env(safe-area-inset-bottom,0)]">
          {mainItems.map(item => (
            <NavItem key={item.href} item={item} />
          ))}

          {moreItems.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <div className="flex flex-col items-center justify-center text-center gap-1 text-xs font-medium text-muted-foreground cursor-pointer">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full">
                    <MoreHorizontal />
                  </div>
                  <span>More</span>
                </div>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-lg">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2"><Logo hideText /> More Options</SheetTitle>
                </SheetHeader>
                <nav className="grid gap-2 py-4">
                  {moreItems.map(item => (
                    <Link key={item.href} href={item.href} className={cn("flex items-center gap-4 p-3 rounded-md", item.active ? 'bg-muted text-primary' : 'text-foreground')}>
                      <div className={cn("p-2 rounded-full", item.active ? 'bg-primary/10' : 'bg-muted')}>
                        {item.icon}
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
      {/* Spacer to prevent content from being hidden behind the bottom nav */}
      <div className="h-[calc(env(safe-area-inset-bottom,0)+4.5rem)] md:hidden" />
    </>
  );
}
