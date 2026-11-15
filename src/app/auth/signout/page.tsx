'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

export default function SignOutPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/auth/signin' })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <p className="text-slate-300">Signing out…</p>
    </div>
  )
}
