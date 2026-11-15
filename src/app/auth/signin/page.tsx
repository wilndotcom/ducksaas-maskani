import { Suspense } from 'react'
import { SignInForm } from './signin-form'

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"><div className="text-slate-300">Loading...</div></div>}>
      <SignInForm />
    </Suspense>
  )
}
