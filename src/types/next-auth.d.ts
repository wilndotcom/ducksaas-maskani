import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      globalRole: 'super_admin' | 'standard'
    } & DefaultSession['user']
  }

  interface User {
    globalRole: 'super_admin' | 'standard'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    globalRole: 'super_admin' | 'standard'
  }
}
