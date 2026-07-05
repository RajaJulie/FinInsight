import { redirect } from "next/navigation"
import { auth } from "@/auth"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, Search, Download, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { TransactionDialog } from "@/components/transaction-dialog";
import { TransactionsTable } from "@/components/transactions-table";


export default async function TransactionsPage() {
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
        <SiteHeader
          user={{
            name: session.user.name ?? "",
            email: session.user.email ?? "",
            avatar: "logo.png",
          }}
        />

        <main className="min-h-screen bg-background px-4 py-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Transactions</h1>
                <p className="text-muted-foreground">
                  Gérez vos revenus et dépenses manuellement.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline">
                  <Download className="mr-2 size-4" />
                  Exporter
                </Button>

                <TransactionDialog />
                
              </div>
            </div>

            <Card className="bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une transaction..."
                      className="pl-9"
                    />
                  </div>

                  <Button variant="outline">Tous les types</Button>
                  <Button variant="outline">Toutes les catégories</Button>
                </div>
              </CardContent>
            </Card>

            <TransactionsTable />

            
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}