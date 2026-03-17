'use client'

import { useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/admin/app-sidebar'
import { Separator } from '@/components/ui/separator'
import TeamModal from '@/components/admin/TeamModal'

type Props = {
  children: React.ReactNode
  adminEmail: string
  adminRole: 'super_admin' | 'admin'
}

export function AdminLayoutShell({ children, adminEmail, adminRole }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)

  return (
    <SidebarProvider>
      <AppSidebar
        adminRole={adminRole}
        adminEmail={adminEmail}
        onTeamOpen={() => setTeamOpen(true)}
      />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="font-bebas text-lg tracking-wide">LAMBA LAB</h1>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
      {teamOpen && <TeamModal onClose={() => setTeamOpen(false)} />}
    </SidebarProvider>
  )
}
