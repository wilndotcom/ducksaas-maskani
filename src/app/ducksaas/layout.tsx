import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { DucksaasShell } from '@/components/ducksaas-shell'

export const instant = false

export default async function DucksaasLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.globalRole !== 'super_admin') {
    redirect('/')
  }
  return <DucksaasShell userName={session.user.name ?? session.user.email ?? 'Admin'}>{children}</DucksaasShell>
}