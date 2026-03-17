'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AppSidebar } from '@/components/admin/app-sidebar'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import TeamModal from '@/components/admin/TeamModal'

type Props = {
  children: React.ReactNode
  adminEmail: string
  adminRole: 'super_admin' | 'admin'
}

export function AdminLayoutShell({ children, adminEmail, adminRole }: Props) {
  const [teamOpen, setTeamOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  return (
    <SidebarProvider>
      <AppSidebar
        adminRole={adminRole}
        adminEmail={adminEmail}
        onTeamOpen={() => setTeamOpen(true)}
      />
      <SidebarInset>
        <header className="bg-background/40 sticky top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b backdrop-blur-md">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
            <h1 className="font-bebas text-lg tracking-wide">LAMBA LAB</h1>

            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="size-8 cursor-pointer">
                    <AvatarFallback className="text-xs font-medium">
                      {adminEmail.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-56" align="end">
                  <DropdownMenuLabel className="p-0">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs font-medium">
                          {adminEmail.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">Admin</span>
                        <span className="text-muted-foreground truncate text-xs">{adminEmail}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>
      <TeamModal open={teamOpen} onOpenChange={setTeamOpen} />
    </SidebarProvider>
  )
}
