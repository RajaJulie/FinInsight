import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AccountsManager } from "@/components/accounts/accounts-manager"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AccountsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <SiteHeader
          user={{
            name: session.user.name ?? "",
            email: session.user.email ?? "",
            avatar: "/logo.png",
          }}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden bg-background px-4 py-6 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-7xl">
            <AccountsManager />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
