
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { permissions } from './lib/data';
import prisma from './lib/prisma';
import type { Role } from './lib/types';

const secret = process.env.NEXTAUTH_SECRET;

async function getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
    });
    if (!user || !user.role) return [];
    return user.role.permissions.split(',');
}

export default async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret });
    const { pathname } = req.nextUrl;

    // If no token, and not on a public page, redirect to login
    if (!token) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', req.url);
        return NextResponse.redirect(loginUrl);
    }
    
    // If authenticated user tries to access login, redirect to dashboard
    if (token && pathname === '/login') {
      const inboxUrl = new URL('/dashboard/inbox', req.url);
      return NextResponse.redirect(inboxUrl);
    }

    // Handle mandatory password change
    const mustChangePassword = !!token.mustChangePassword;
    if (mustChangePassword && pathname !== '/dashboard/change-password') {
        return NextResponse.redirect(new URL('/dashboard/change-password', req.url));
    }
    if (!mustChangePassword && pathname === '/dashboard/change-password') {
        return NextResponse.redirect(new URL('/dashboard/inbox', req.url));
    }

    // Server-side RBAC for admin routes
    if (pathname.startsWith('/dashboard/admin')) {
        const userPermissions = await getUserPermissions(token.id as string);
        if (!userPermissions.includes('view_admin')) {
            return NextResponse.redirect(new URL('/dashboard/access-denied', req.url));
        }
    }
    
    // If all checks pass, continue to the requested page
    return NextResponse.next();
}


export const config = {
  // Matcher protecting all internal routes.
  // Excludes public files, API routes, and the login page.
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\..*|favicon.ico|login).*)",
  ],
}
