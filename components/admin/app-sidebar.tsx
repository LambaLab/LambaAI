'use client'

import { ClipboardList, BarChart3, Users, Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { NavUser } from '@/components/admin/nav-user'

type Props = {
  adminRole: 'super_admin' | 'admin' | null
  adminEmail: string
  onTeamOpen: () => void
}

export function AppSidebar({ adminRole, adminEmail, onTeamOpen }: Props) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg font-bebas text-sm">
                  LL
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bebas text-lg tracking-wide">LAMBA LAB</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Proposals">
                  <ClipboardList />
                  <span>Proposals</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Analytics" disabled>
                  <BarChart3 />
                  <span>Analytics</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="text-[10px] text-muted-foreground">
                  Soon
                </SidebarMenuBadge>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminRole === 'super_admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Team" onClick={onTeamOpen}>
                    <Users />
                    <span>Team</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Settings" disabled>
                    <Settings />
                    <span>Settings</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="text-[10px] text-muted-foreground">
                    Soon
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <ThemeToggle />
        <NavUser email={adminEmail} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
