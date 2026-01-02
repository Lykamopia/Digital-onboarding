
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import prisma from './lib/prisma';
import type { User } from './lib/types';

const secret = process.env.NEXTAUTH_SECRET;

async function getActiveUser(userId: string): Promise<User | null> {
    if (!userId) return null;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true }
        });

        if (user && user.status === 'active') {
            return user as User;
        }
        return null;
    } catch (error) {
        console.error("Middleware DB error:", error);
        return null;
    }
}

export default async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret });
    const { pathname } = req.nextUrl;
    
    // --- 1. Primary Token & User Validation ---
    if (!token || !token.id) {
        // If no token, redirect to login for protected routes.
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', req.url);
        return NextResponse.redirect(loginUrl);
    }
    
    // On every request, validate the token against the database.
    const user = await getActiveUser(token.id as string);

    if (!user) {
        // User not found or is inactive. Invalidate session.
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('error', 'SessionInvalidated');
        // Clear the session cookie by redirecting.
        return NextResponse.redirect(loginUrl);
    }
    
    // --- 2. Handle Specific Page Access Rules ---

    // If authenticated user tries to access login, redirect to dashboard
    if (pathname === '/login') {
      const inboxUrl = new URL('/dashboard/inbox', req.url);
      return NextResponse.redirect(inboxUrl);
    }

    // Handle mandatory password change
    const mustChangePassword = !!user.mustChangePassword;
    if (mustChangePassword && pathname !== '/dashboard/change-password') {
        return NextResponse.redirect(new URL('/dashboard/change-password', req.url));
    }
    if (!mustChangePassword && pathname === '/dashboard/change-password') {
        return NextResponse.redirect(new URL('/dashboard/inbox', req.url));
    }

    // Server-side RBAC for admin routes
    if (pathname.startsWith('/dashboard/admin')) {
        const userPermissions = user.role?.permissions ? user.role.permissions.split(',') : [];
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
    "/((?!api|_next/static|_next/image|.*\\.png|.*\\.jpeg|.*\\.svg|favicon.ico|login).*)",
  ],
}
