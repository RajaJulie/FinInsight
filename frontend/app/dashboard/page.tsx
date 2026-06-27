import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CategorySection } from "@/components/category-section"
import { TransactionsSection } from "@/components/transactions-section"
import { BankConnections } from "@/components/bank-connections"
import { ExpenseDistribution } from "@/components/expense-distribution"
import { MonthlyInsight } from "@/components/monthly-insight"

import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function Page() {
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
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="grid gap-6 px-4 py-4 lg:grid-cols-[1fr_minmax(450px,500px)] lg:px-6 md:py-6">
              {/* Colonne gauche */}
              <div className=" mx-auto w-full max-w-[1100px] space-y-6">
                <SectionCards />
                <CategorySection />
                <TransactionsSection />
              </div>

              {/* Colonne droite */}
              <div className="mx-auto w-full max-w-[1100px] space-y-6">
                <BankConnections />
                <ExpenseDistribution /> 
                <MonthlyInsight /> 
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
