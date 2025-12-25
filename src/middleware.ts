
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { withAuth } from "next-auth/middleware";
import { getLoggedInUser } from '@/app/actions/memo'; // This is a server action, cannot be used in middleware
import prisma from '@/lib/prisma'; // Import prisma client directly

const secret = process.env.NEXTAUTH_SECRET;

export default async function middleware(req: NextRequest) {
    const token = await getToken({ req, secret });
    const { pathname } = req.nextUrl;
    
    // If no token, and not trying to access login, redirect to login
    if (!token && pathname !== '/login') {
        const loginUrl = new URL('/login', req.url);
        return NextResponse.redirect(loginUrl);
    }
    
    // If token exists, check for mandatory password change
    if (token) {
        if (!token.email) {
            // This case should ideally not happen if session is managed correctly
             const loginUrl = new URL('/login', req.url);
             loginUrl.searchParams.set('error', 'Missing email in token');
             return NextResponse.redirect(loginUrl);
        }

        const user = await prisma.user.findUnique({
            where: { email: token.email }
        });

        const mustChangePassword = user?.mustChangePassword;

        if (mustChangePassword && pathname !== '/dashboard/change-password') {
            const changePasswordUrl = new URL('/dashboard/change-password', req.url);
            return NextResponse.redirect(changePasswordUrl);
        }

        if (!mustChangePassword && pathname === '/dashboard/change-password') {
             const dashboardUrl = new URL('/dashboard', req.url);
             return NextResponse.redirect(dashboardUrl);
        }
    }
    
    // If all checks pass, use withAuth to handle default authorization
    // This part might seem redundant but `withAuth` also augments the request object
    const authMiddleware = withAuth({
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: '/login',
        }
    });

    // @ts-ignore
    return authMiddleware(req);
}


export const config = {
  // Matcher protecting all routes except login, api, and static files
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\..*|login).*)",
  ],
}
