import { withAuth } from "next-auth/middleware"

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    // You can add logic here if you need to perform additional checks
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  // Matcher protecting all routes except login, api, and static files
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|public).*)",
  ],
}
