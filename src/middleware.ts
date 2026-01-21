
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

function generateCsp(nonce: string) {
    const policies = {
        'default-src': ["'self'"],
        'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        'img-src': ["'self'", "data:", "https://images.unsplash.com", "https://picsum.photos"],
        'connect-src': ["'self'", "ws://localhost:3011", "http://localhost:3011"],
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

const securityHeaders = [
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    {
        key: 'X-Permitted-Cross-Domain-Policies',
        value: 'none',
    },
    {
        key: 'Cross-Origin-Embedder-Policy',
        value: 'require-corp',
    },
    {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
    },
    {
        key: 'Cross-Origin-Resource-Policy',
        value: 'same-origin',
    }
];

export default withAuth(
  function middleware(req: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = generateCsp(nonce);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nonce', nonce);
    
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // Set all security headers on the response
    securityHeaders.forEach(header => {
        response.headers.set(header.key, header.value);
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
