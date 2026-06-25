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

import data from "./data.json"

export default function Page() {
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
        <SiteHeader />

        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2 overflow-x-hidden">
            <div className="grid min-w-0 grid-cols-1 gap-6 px-4 py-4 md:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(350px,500px)] xl:px-6">
              {/* Colonne gauche */}
              <div className="min-w-0 w-full space-y-6">
                <SectionCards />
                <CategorySection />
                <TransactionsSection />
              </div>

              {/* Colonne droite */}
              <div className="min-w-0 w-full space-y-6">
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
