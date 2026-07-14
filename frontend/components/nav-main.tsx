"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ChartPie,
  CreditCard,
  Home,
  ListChecks,
  Tags,
  Target,
  type LucideIcon,
} from "lucide-react"
import {
  getNavigationItem,
  type NavigationIcon,
  type NavigationItem,
} from "@/lib/navigation"

const navigationIcons: Record<NavigationIcon, LucideIcon> = {
  dashboard: Home,
  transactions: ListChecks,
  categories: Tags,
  accounts: CreditCard,
  budgets: ChartPie,
  goals: Target,
  insights: BarChart3,
}

export function NavMain({
  items,
}: {
  items: NavigationItem[]
}) {
  const pathname = usePathname()
  const activeItem = getNavigationItem(pathname)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = navigationIcons[item.icon]

            return (
              <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className={
                  activeItem?.url === item.url
                    ? "h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-800 text-white hover:text-white"
                    : "h-11 rounded-xl text-white/70 hover:bg-white/5 hover:text-white"
                }
              >
                <a href={item.url}>
                  <Icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
