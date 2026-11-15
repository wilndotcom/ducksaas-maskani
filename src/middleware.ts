import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const path = req.nextUrl.pathname

  // DuckSaaS admin area - dedicated admin sign-in, super_admin only
  if (path === '/ducksaas' || path.startsWith('/ducksaas/')) {
    if (!token) {
      return NextResponse.redirect(new URL('/auth/admin', req.url))
    }
    if (token.globalRole !== 'super_admin') {
      return NextResponse.redirect(new URL('/maskani', req.url))
    }
    return NextResponse.next()
  }

  // Maskani workspace + tenant portal - shared sign-in page
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/ducksaas/:path*',
    '/maskani/:path*',
    '/portal/:path*'
  ]
}
