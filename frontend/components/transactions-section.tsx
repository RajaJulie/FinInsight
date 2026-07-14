"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type RecentTransaction = {
  id: string
  title: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  date: string
}

type DashboardSummary = {
  recentTransactions: RecentTransaction[]
}

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

export function TransactionsSection() {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function fetchRecentTransactions() {
      try {
        const response = await fetch("/api/dashboard/summary", {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Impossible de charger les transactions récentes.")
        }

        const data: DashboardSummary = await response.json()

        setTransactions(data.recentTransactions)
        setError("")
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        setError("Impossible de charger les transactions récentes.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void fetchRecentTransactions()

    return () => controller.abort()
  }, [])

  return (
    <div className="min-w-0 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-[#071226] *:data-[slot=card]:to-[#0b1d3a] *:data-[slot=card]:shadow-xs lg:px-6 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card w-full min-w-0">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <CardTitle className="min-w-0 break-words">Transactions récentes</CardTitle>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-violet-400 hover:text-violet-300"
            >
              <Link href="/transactions">Voir toutes</Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="min-w-0 overflow-x-auto">
          <div className="grid min-w-[600px] grid-cols-[2fr_2fr_1.5fr_1fr] rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
            <span>Date</span>
            <span>Description</span>
            <span>Catégorie</span>
            <span className="text-right">Montant</span>
          </div>

          {isLoading && (
            <p className="px-4 py-6 text-sm text-white/60">
              Chargement des transactions...
            </p>
          )}

          {!isLoading && error && (
            <p role="alert" className="px-4 py-6 text-sm text-red-400">
              {error}
            </p>
          )}

          {!isLoading && !error && transactions.length === 0 && (
            <p className="px-4 py-6 text-sm text-white/60">
              Aucune transaction pour le moment.
            </p>
          )}

          {!isLoading &&
            !error &&
            transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid min-w-[600px] grid-cols-[2fr_2fr_1.5fr_1fr] items-center border-b border-white/5 px-4 py-4"
              >
                <div className="text-white/60">
                  {dateFormatter.format(new Date(transaction.date))}
                </div>

                <div className="min-w-0 truncate font-medium text-white">
                  {transaction.title}
                </div>

                <div className="min-w-0">
                  <span
                    className={`inline-block max-w-full truncate rounded-md px-3 py-1 text-sm ${
                      transaction.type === "INCOME"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-violet-500/10 text-violet-400"
                    }`}
                  >
                    {transaction.category}
                  </span>
                </div>

                <div
                  className={`text-right font-semibold ${
                    transaction.type === "INCOME"
                      ? "text-green-400"
                      : "text-white"
                  }`}
                >
                  {transaction.type === "INCOME" ? "+" : "-"}
                  {euroFormatter.format(transaction.amount)}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
