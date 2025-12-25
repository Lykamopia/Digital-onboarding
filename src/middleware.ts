
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

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
        const mustChangePassword = token.mustChangePassword as boolean;

        if (mustChangePassword && pathname !== '/dashboard/change-password') {
            const changePasswordUrl = new URL('/dashboard/change-password', req.url);
            return NextResponse.redirect(changePasswordUrl);
        }

        if (!mustChangePassword && pathname === '/dashboard/change-password') {
             const dashboardUrl = new URL('/dashboard', req.url);
             return NextResponse.redirect(dashboardUrl);
        }
    }
    
    // If all checks pass, continue to the requested page
    return NextResponse.next();
}


export const config = {
  // Matcher protecting all routes except login, api, and static files
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\..*|login|favicon.ico).*)",
  ],
}
