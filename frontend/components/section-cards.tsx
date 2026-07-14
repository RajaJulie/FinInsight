"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUp, Wallet, HandCoins } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartAreaLinear } from "@/components/chart-area-line-dots"
import type { BalanceChartData } from "@/components/chart-area-line-dots"

type DashboardSummary = {
  balance: number
  monthlyIncome: number
  monthlyExpense: number
  monthlySaving: number
}

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const months = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
]
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index)

function formatEuro(amount: number) {
  return euroFormatter.format(amount)
}

export function SectionCards() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [selectedMonth, setSelectedMonth] = useState("all")
  const [chartData, setChartData] = useState<BalanceChartData | null>(null)
  const [isChartLoading, setIsChartLoading] = useState(true)
  const [chartError, setChartError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function fetchSummary() {
      try {
        setIsLoading(true)
        setError("")

        const response = await fetch("/api/dashboard/summary", {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Impossible de charger le résumé.")
        }

        const data = (await response.json()) as DashboardSummary
        setSummary(data)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setError("Impossible de charger les données du dashboard.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchSummary()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchChart() {
      try {
        setIsChartLoading(true)
        setChartError("")

        const params = new URLSearchParams({
          year: selectedYear,
          month: selectedMonth,
        })
        const response = await fetch(`/api/dashboard/chart?${params}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Impossible de charger le graphique.")
        }

        const data = (await response.json()) as BalanceChartData
        setChartData(data)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setChartError("Impossible de charger le graphique.")
      } finally {
        if (!controller.signal.aborted) {
          setIsChartLoading(false)
        }
      }
    }

    void fetchChart()

    return () => controller.abort()
  }, [selectedMonth, selectedYear])

  const balance = summary?.balance ?? 0
  const monthlyIncome = summary?.monthlyIncome ?? 0
  const monthlyExpense = summary?.monthlyExpense ?? 0
  const monthlySaving = summary?.monthlySaving ?? 0
  const amountPlaceholder = isLoading ? "Chargement..." : formatEuro(0)
  const formattedMonthlySaving = `${monthlySaving >= 0 ? "+" : ""}${formatEuro(
    monthlySaving
  )}`

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-[#071226] *:data-[slot=card]:to-[#0b1d3a] *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-2 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card w-full min-w-0">
        <CardHeader className="flex min-w-0 flex-col gap-4 @[480px]/card:flex-row @[480px]/card:items-start @[480px]/card:justify-between">
          <div className="min-w-0">
            <CardDescription>Solde total</CardDescription>
            <CardTitle className="break-words text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {isLoading ? amountPlaceholder : formatEuro(balance)}
            </CardTitle>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2 @[480px]/card:justify-end">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] max-w-full rounded-lg border-white/8 bg-black/10 px-2 py-1 text-xs text-white shadow-sm">
                  <SelectValue aria-label="Année" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[145px] max-w-full rounded-lg border-white/8 bg-black/10 px-2 py-1 text-xs text-white shadow-sm">
                  <SelectValue aria-label="Mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {months.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
        </CardHeader>
        <CardFooter className="min-w-0 flex-col items-center gap-4 text-center text-sm @[480px]/card:flex-row @[480px]/card:items-end @[480px]/card:justify-between @[480px]/card:text-left">
          <div
            className={`flex min-w-0 flex-wrap justify-center gap-2 break-words font-medium @[480px]/card:justify-start ${
              monthlySaving >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {isLoading ? "Chargement..." : formattedMonthlySaving}
            <span className="text-muted-foreground">
              ce mois-ci
            </span>
          </div>

          <div className="h-[110px] w-full min-w-0 max-w-[260px] shrink-0">
            {isChartLoading && (
              <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Chargement du graphique...
              </p>
            )}
            {!isChartLoading && chartError && (
              <p
                role="alert"
                className="flex h-full items-center justify-center text-xs text-red-400"
              >
                {chartError}
              </p>
            )}
            {!isChartLoading && !chartError && chartData && (
              <ChartAreaLinear chart={chartData} />
            )}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card w-full min-w-0">
        <CardHeader className="min-w-0">
          <div className="grid w-full min-w-0 grid-cols-1 gap-6 @[520px]/card:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Wallet className="h-6 w-6 text-green-500" />
              </div>

              <CardDescription>Revenus</CardDescription>
              <CardTitle className="truncate text-xl font-semibold tabular-nums text-green-500">
                {isLoading ? amountPlaceholder : formatEuro(monthlyIncome)}
              </CardTitle>

              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="size-4" />
                Mois courant
              </CardDescription>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <HandCoins className="h-6 w-6 text-red-500" />
              </div>

              <CardDescription>Dépenses</CardDescription>
              <CardTitle className="truncate text-xl font-semibold tabular-nums text-red-500">
                {isLoading ? amountPlaceholder : formatEuro(monthlyExpense)}
              </CardTitle>

              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="size-4" />
                Mois courant
              </CardDescription>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <HandCoins className="h-6 w-6 text-blue-500" />
              </div>

              <CardDescription>Épargne</CardDescription>
              <CardTitle className="truncate text-xl font-semibold tabular-nums text-blue-500">
                {isLoading ? amountPlaceholder : formatEuro(monthlySaving)}
              </CardTitle>

              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="size-4" />
                Mois courant
              </CardDescription>
            </div>
          </div>
          {error && (
            <CardDescription className="mt-4 text-red-400">
              {error}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
    </div>
  )
}
