"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Home,
  ListChecks,
  CircleDollarSign,
  CreditCard,
  Folder,
  Target,
  BarChart3,
  Settings,
  CircleHelp,
  Tags,
  ChartPie,
} from "lucide-react"


const data = {
  navMain: [
    { title: "Tableau de bord", url: "/dashboard", icon: <Home /> },
    { title: "Transactions", url: "/transactions", icon: <ListChecks /> },
    { title: "Catégories", url: "#", icon: <Tags /> },
    { title: "Comptes", url: "#", icon: <CreditCard /> },
    { title: "Budgets", url: "#", icon: <ChartPie /> },
    { title: "Objectifs", url: "#", icon: <Target /> },
    { title: "Insights", url: "#", icon: <BarChart3 /> },
    
  ],
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
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      
    </Sidebar>
  )
}
