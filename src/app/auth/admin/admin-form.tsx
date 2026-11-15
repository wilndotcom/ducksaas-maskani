'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ShieldCheck, ArrowRight, LogIn } from 'lucide-react'

export function AdminSignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/ducksaas')
        router.refresh()
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 pl-10 text-white placeholder-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-600/30 blur-3xl" />
        <div className="absolute top-1/4 -right-24 h-[28rem] w-[28rem] rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-slate-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Restricted access
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              DuckSaaS <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">Admin</span>
            </h1>
            <p className="mt-2 text-slate-300">Platform administration sign in</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            {error && (
              <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/15 p-4">
                <p className="text-sm text-rose-200">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
                  Username or Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="admin or admin@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:opacity-95 disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-6">
              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <p className="mb-2 text-center text-sm font-medium text-slate-200">Demo credentials</p>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <p><span className="text-cyan-300">Username:</span> admin</p>
                  <p><span className="text-cyan-300">Email:</span> admin@ducksaas.com</p>
                  <p><span className="text-cyan-300">Password:</span> admin123</p>
                </div>
              </div>
              <p className="mt-3 text-center text-sm text-slate-300">
                Landlord, caretaker, or tenant?{' '}
                <Link href="/auth/signin" className="font-medium text-cyan-300 hover:text-cyan-200">Use the workspace sign in</Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center">
            <Link href="/" className="text-sm text-slate-400 hover:text-white">← Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
