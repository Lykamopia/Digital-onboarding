
"use client"

import { LogOut, User as UserIcon } from "lucide-react"
import Link from "next/link";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User } from "@/lib/types";
import { revokeUserTokens } from "@/app/actions/memo";

export function UserNav({ user }: { user: User }) {
  
  if (!user) return null;

  const handleSignOut = async () => {
    await revokeUserTokens(user.id);
    signOut({ callbackUrl: '/login' });
  }

  const getAvatarUrl = () => {
    const p = user.avatar?.toString().trim();
    if (!p) return user.image || undefined;
    if (p.startsWith('http')) return p;
    if (p.startsWith('/uploads')) return p;
    if (p.startsWith('uploads')) return '/' + p;
    // fallback to existing API-backed avatars
    return p.startsWith('/') ? `/api${p}` : `/api/${p}`;
  }

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9 border border-primary">
              <AvatarImage src={getAvatarUrl()} alt={user.name || ''} data-ai-hint="person portrait"/>
              <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <Link href="/dashboard/profile" passHref>
              <DropdownMenuItem>
                <UserIcon className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  )
}
