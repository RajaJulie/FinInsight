"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { CircleHelp, Settings } from "lucide-react"
import { mainNavigationItems } from "@/lib/navigation"


const data = {
  /*navClouds: [
    {
      title: "Insights",
      icon: (
        <CameraIcon
        />
      ),
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Alertes",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: (
        <FileTextIcon
        />
      ),
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],*/
  navSecondary: [
    { title: "Paramètres", url: "#", icon: <Settings /> },
    { title: "Aide & support", url: "#", icon: <CircleHelp /> },
  ],
  /*documents: [
    {
      name: "Data Library",
      url: "#",
      icon: (
        <DatabaseIcon
        />
      ),
    },
    {
      name: "Reports",
      url: "#",
      icon: (
        <FileChartColumnIcon
        />
      ),
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: (
        <FileIcon
        />
      ),
    },
  ],*/
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" className="z-50" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard" >
                <img
                  src="/FinInsight_transparent.png"
                  alt="SpendSense"
                  className="hidden dark:block h-40 w-auto"
                />

                <img
                  src="/FinInsight_light_transparent.png"
                  alt="SpendSense"
                  className="block dark:hidden h-40 w-auto"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNavigationItems} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      
    </Sidebar>
  )
}
