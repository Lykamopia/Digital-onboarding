
"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getLoggedInUser } from '@/app/actions/memo';
import type { Permission, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatePresence } from 'framer-motion';
import { AnimatedContent } from '@/components/animated-content';
import { navItemsConfig } from './config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';


function useAdminNavigation(user: (User & { role: { permissions: Permission[] } }) | null) {
  const pathname = usePathname();
  const router = useRouter();

  const accessibleNavItems = useMemo(() => {
    if (!user) return [];
    return navItemsConfig.filter(item => user.role.permissions.includes(item.permission as Permission));
  }, [user]);

  const activeTab = useMemo(() => {
    // Find the best-matching tab for the current path
    return accessibleNavItems.find(item => pathname.startsWith(item.value))?.value || null;
  }, [accessibleNavItems, pathname]);

  useEffect(() => {
    if (user && accessibleNavItems.length > 0) {
      const currentTabIsValid = accessibleNavItems.some(item => pathname.startsWith(item.value));
      // If the current URL doesn't match any accessible tab, redirect to the first accessible one.
      if (!currentTabIsValid) {
        router.replace(accessibleNavItems[0].value);
      }
    } else if (user && accessibleNavItems.length === 0) {
      // If user has no admin permissions, redirect away from admin area
      if (pathname.startsWith('/dashboard/admin')) {
          router.replace('/dashboard/access-denied');
      }
    }
  }, [user, pathname, accessibleNavItems, router]);

  return { activeTab, accessibleNavItems };
}

function AdminPageContent({ user, activeTab, accessibleNavItems, handleTabChange, children }: {
    user: (User & { role: { permissions: Permission[] } }) | null;
    activeTab: string | null;
    accessibleNavItems: { value: string; label: string; permission: string; }[];
    handleTabChange: (value: string) => void;
    children: React.ReactNode;
}) {
    const tabsListRef = useRef<HTMLDivElement>(null);
    const [visibleItems, setVisibleItems] = useState(accessibleNavItems);
    const [hiddenItems, setHiddenItems] = useState<typeof accessibleNavItems>([]);

    const updateVisibleTabs = useCallback(() => {
        if (!tabsListRef.current) return;
        
        const container = tabsListRef.current;
        const containerWidth = container.offsetWidth;
        const moreButtonWidth = 80;
        
        let totalWidth = 0;
        let newVisible = [];
        let newHidden = [];
        let needsDropdown = false;

        const tempTabContainer = document.createElement('div');
        tempTabContainer.style.position = 'absolute';
        tempTabContainer.style.visibility = 'hidden';
        tempTabContainer.style.display = 'flex';
        container.appendChild(tempTabContainer);

        const tabElements = accessibleNavItems.map(item => {
            const el = document.createElement('button');
            el.className = 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium';
            el.textContent = item.label;
            tempTabContainer.appendChild(el);
            return el;
        });

        for(let i=0; i < tabElements.length; i++) {
            const itemWidth = tabElements[i].offsetWidth;
            if (totalWidth + itemWidth > containerWidth - moreButtonWidth) {
                needsDropdown = true;
                newHidden.push(accessibleNavItems[i]);
            } else {
                newVisible.push(accessibleNavItems[i]);
                totalWidth += itemWidth;
            }
        }
        
        container.removeChild(tempTabContainer);
        
        if (needsDropdown) {
             setVisibleItems(newVisible);
             setHiddenItems(newHidden);
        } else {
             setVisibleItems(accessibleNavItems);
             setHiddenItems([]);
        }

    }, [accessibleNavItems]);

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            updateVisibleTabs();
        });
        if (tabsListRef.current) {
            observer.observe(tabsListRef.current);
        }
        updateVisibleTabs(); // Initial calculation
        return () => observer.disconnect();
    }, [updateVisibleTabs]);

    if (!user) {
        return <Skeleton className="h-[200px] w-full" />;
    }

    if (accessibleNavItems.length === 0) {
        // This state is handled by the redirect in the hook, but as a fallback, show nothing.
        return null;
    }
    
    // While redirecting from an invalid tab, show a loader.
    if (!activeTab) {
        return <Skeleton className="h-[200px] w-full" />;
    }

    const isMoreMenuActive = hiddenItems.some(item => item.value === activeTab);

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="border-b">
                <TabsList ref={tabsListRef} className="relative h-auto justify-start p-1">
                    {visibleItems.map((item) => (
                        <TabsTrigger 
                            key={item.value} 
                            value={item.value}
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                            {item.label}
                        </TabsTrigger>
                    ))}
                    {hiddenItems.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        "h-9 px-3 data-[state=open]:bg-muted",
                                        isMoreMenuActive && "bg-primary/10 text-primary"
                                    )}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {hiddenItems.map((item) => (
                                    <DropdownMenuItem
                                        key={item.value}
                                        onClick={() => handleTabChange(item.value)}
                                        className={cn(activeTab === item.value && 'bg-accent')}
                                    >
                                        {item.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </TabsList>
            </div>
            <div className="mt-4">
                <AnimatePresence mode="wait">
                    <AnimatedContent key={activeTab}>
                        {children}
                    </AnimatedContent>
                </AnimatePresence>
            </div>
        </Tabs>
    );
}


const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<(User & { role: { permissions: Permission[] } }) | null>(null);
  const [loading, setLoading] = useState(true);

  const { activeTab, accessibleNavItems } = useAdminNavigation(user);

  useEffect(() => {
    getLoggedInUser().then(userData => {
      setUser(userData as any);
      setLoading(false);
    });
  }, []);
  
  const handleTabChange = (value: string) => {
    router.push(value);
  };
  
  return (
    <Card>
       <CardHeader>
        <CardTitle>Admin Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
            <Skeleton className="h-[200px] w-full" />
        ) : (
            <AdminPageContent
                user={user}
                activeTab={activeTab}
                accessibleNavItems={accessibleNavItems}
                handleTabChange={handleTabChange}
            >
                {children}
            </AdminPageContent>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminLayout;
    