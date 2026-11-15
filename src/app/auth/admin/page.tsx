import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AdminSignInForm } from './admin-form'

export const instant = false

export default async function AdminSignInPage() {
  const session = await getServerSession(authOptions)
  if (session?.user.globalRole === 'super_admin') {
    redirect('/ducksaas')
  }
  return <AdminSignInForm />
}
