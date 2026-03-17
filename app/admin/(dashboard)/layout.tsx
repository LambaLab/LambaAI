import { redirect } from 'next/navigation'
import { verifyAdminReadOnly } from '@/lib/admin/auth'

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await verifyAdminReadOnly()

  if (!auth.admin) {
    redirect('/admin/login')
  }

  return <>{children}</>
}
