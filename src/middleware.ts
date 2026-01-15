
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { NextURL } from "next/dist/server/web/next-url";

function generateCsp(nonce: string) {
    const policies = {
        'default-src': ["'self'"],
        'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'"], // 'unsafe-inline' is often needed for UI libraries
        'img-src': ["'self'", "data:", "https://images.unsplash.com", "https://picsum.photos"],
        'connect-src': ["'self'"],
        'font-src': ["'self'", "https://fonts.gstatic.com"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': [],
    };

    const csp = Object.entries(policies)
        .map(([key, value]) => `${key} ${value.join(' ')}`)
        .join('; ');

    return csp;
}

export default withAuth(
  function middleware(req: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = generateCsp(nonce);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);
    
    // Return a new response with the updated headers, allowing NextAuth to handle the rest
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set('Content-Security-Policy', csp);
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
        signIn: '/login',
    }
  }
);

export const config = {
  // Matcher protecting all routes except login, api, and static files
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|SVG|PNG|JPG|JPEG|GIF|WEBP|ICO|MP3)).*)",
  ],
}
