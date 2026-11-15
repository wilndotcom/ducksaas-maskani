import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Super admin routes - only super_admin can access /ducksaas
    if (path.startsWith('/ducksaas')) {
      if (token?.globalRole !== 'super_admin') {
        return NextResponse.redirect(new URL('/maskani', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    '/ducksaas/:path*',
    '/maskani/:path*',
    '/portal/:path*'
  ]
}
