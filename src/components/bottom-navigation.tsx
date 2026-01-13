
'use client';

import { Archive, Edit, FilePlus, Home, Inbox, Send, Shield, Star, User as UserIcon, MoreHorizontal, Lock, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Permission, User } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from './ui/button';
import Logo from './logo';
import { Separator } from './ui/separator';

interface BottomNavigationProps {
  user: User & { role: { permissions: Permission[] } };
}

export function BottomNavigation({ user }: BottomNavigationProps) {
  const pathname = usePathname();

  const allNavItems = [
    ...(user.mustChangePassword
      ? [
          { href: "/dashboard/change-password", icon: <Lock />, label: "Change Password", active: pathname === '/dashboard/change-password', visible: true },
          { href: "/dashboard/access-denied", icon: <ShieldAlert />, label: "Access Denied", active: pathname === '/dashboard/access-denied', visible: true, className: "hidden" },
        ]
      : [
          { href: "/dashboard/inbox", icon: <Inbox />, label: "Inbox", active: pathname === '/dashboard/inbox', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/favorites", icon: <Star />, label: "Favorites", active: pathname === '/dashboard/favorites', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/new", icon: <FilePlus />, label: "New", active: pathname === '/dashboard/new', visible: user.role.permissions.includes('manage_memos' as Permission), isFab: true },
          { href: "/dashboard/sent", icon: <Send />, label: "Sent", active: pathname === '/dashboard/sent', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/drafts", icon: <Edit />, label: "Drafts", active: pathname === '/dashboard/drafts', visible: user.role.permissions.includes('manage_memos' as Permission) },
          { href: "/dashboard/archive", icon: <Archive />, label: "Archive", active: pathname === '/dashboard/archive', visible: user.role.permissions.includes('view_dashboard' as Permission) },
          { href: "/dashboard/profile", icon: <UserIcon />, label: "Profile", active: pathname === '/dashboard/profile', visible: true },
          { href: "/dashboard/admin", icon: <Shield />, label: "Admin", active: pathname.startsWith('/dashboard/admin'), visible: user.role.permissions.includes('view_admin' as Permission) },
          { href: "/dashboard/access-denied", icon: <ShieldAlert />, label: "Access Denied", active: pathname === '/dashboard/access-denied', visible: true, className: "hidden" },
        ]),
  ];

  const visibleNavItems = allNavItems.filter(item => item.visible && !item.className?.includes('hidden'));

  const fabItem = visibleNavItems.find(item => item.isFab);
  const mainItems = visibleNavItems.filter(item => !item.isFab).slice(0, 4);
  const moreItems = visibleNavItems.filter(item => !item.isFab).slice(4);

  const NavItem = ({ item }: { item: typeof visibleNavItems[0] }) => (
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

          {fabItem && (
            <Link href={fabItem.href} className="absolute bottom-[calc(env(safe-area-inset-bottom,0)+1.5rem)] left-1/2 -translate-x-1/2 z-50">
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
              >
                <FilePlus className="w-8 h-8" />
              </motion.div>
            </Link>
          )}

          {moreItems.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <div className="flex flex-col items-center justify-center text-center gap-1 text-xs font-medium text-muted-foreground">
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

