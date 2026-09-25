"use client"

import { useEffect, useState } from "react"
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CircleDollarSign,
  Layers3,
  Trophy,
} from "lucide-react"
import { Cell, Label, Pie, PieChart } from "recharts"

import { CategoryIcon } from "@/components/categories/category-icon"
import type {
  CategoryAnalysisItem,
  CategoryAnalysisResponse,
  CategoryType,
} from "@/components/categories/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

type Period = "month" | "year" | "all"

const months = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
]

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const chartConfig = {
  amount: { label: "Montant" },
} satisfies ChartConfig

function formatPercentage(value: number | null) {
  if (value === null) return "Non comparable"
  return `${value > 0 ? "+" : ""}${Math.round(value)} %`
}

function AnalysisSummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof CircleDollarSign
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardContent className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold text-white">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryTrend({ category }: { category: CategoryAnalysisItem }) {
  if (category.percentageChange === null) {
    return <span className="text-muted-foreground">Pas de comparaison</span>
  }

  const isIncrease = category.percentageChange > 0
  const Icon = isIncrease ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={
        isIncrease
          ? "inline-flex items-center gap-1 text-orange-300"
          : "inline-flex items-center gap-1 text-green-300"
      }
    >
      <Icon aria-hidden="true" className="size-4" />
      {formatPercentage(category.percentageChange)}
    </span>
  )
}

export function CategoryAnalysis({ refreshKey }: { refreshKey: number }) {
  const now = new Date()
  const [period, setPeriod] = useState<Period>("month")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [type, setType] = useState<CategoryType>("EXPENSE")
  const [data, setData] = useState<CategoryAnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({
      period,
      year: String(year),
      month: String(month),
      type,
    })

    async function loadAnalysis() {
      try {
        setIsLoading(true)
        setError("")
        const response = await fetch(`/api/categories/analytics?${params}`, {
          signal: controller.signal,
        })
        const responseData = (await response.json()) as CategoryAnalysisResponse & {
          message?: string
        }

        if (!response.ok) {
          throw new Error(responseData.message ?? "Impossible de charger l’analyse.")
        }

        setData(responseData)
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger l’analyse."
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAnalysis()

    return () => controller.abort()
  }, [month, period, refreshKey, type, year])

  const availableYears = data?.availableYears ?? [now.getFullYear()]
  const categories = data?.categories ?? []
  const totalAmount = data?.summary.totalAmount ?? 0

  return (
    <div className="space-y-6">
      <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardContent className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Type de catégories">
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              aria-pressed={type === "EXPENSE"}
              onClick={() => setType("EXPENSE")}
            >
              Dépenses
            </Button>
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              aria-pressed={type === "INCOME"}
              onClick={() => setType("INCOME")}
            >
              Revenus
            </Button>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="category-period">
                Période
              </label>
              <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                <SelectTrigger id="category-period" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Un mois</SelectItem>
                  <SelectItem value="year">Une année</SelectItem>
                  <SelectItem value="all">Toute la période</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="category-year">
                Année
              </label>
              <Select
                value={String(year)}
                disabled={period === "all"}
                onValueChange={(value) => setYear(Number(value))}
              >
                <SelectTrigger id="category-year" className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((availableYear) => (
                    <SelectItem key={availableYear} value={String(availableYear)}>
                      {availableYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="category-month">
                Mois
              </label>
              <Select
                value={String(month)}
                disabled={period !== "month"}
                onValueChange={(value) => setMonth(Number(value))}
              >
                <SelectTrigger id="category-month" className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((monthName, index) => (
                    <SelectItem key={monthName} value={String(index + 1)}>
                      {monthName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-10 text-center">
            <p role="alert" className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalysisSummaryCard
              title={type === "EXPENSE" ? "Total des dépenses" : "Total des revenus"}
              value={euroFormatter.format(totalAmount)}
              description="Sur la période sélectionnée"
              icon={CircleDollarSign}
            />
            <AnalysisSummaryCard
              title={type === "EXPENSE" ? "Plus dépensière" : "Revenu principal"}
              value={data?.summary.topCategory?.name ?? "Aucune"}
              description={
                data?.summary.topCategory
                  ? euroFormatter.format(data.summary.topCategory.amount)
                  : "Aucune transaction"
              }
              icon={Trophy}
            />
            <AnalysisSummaryCard
              title="Catégories utilisées"
              value={String(data?.summary.usedCategoryCount ?? 0)}
              description="Avec au moins une transaction"
              icon={Layers3}
            />
            <AnalysisSummaryCard
              title="Évolution"
              value={formatPercentage(data?.summary.percentageChange ?? null)}
              description={period === "all" ? "Toute la période" : "Par rapport à la période précédente"}
              icon={CalendarRange}
            />
          </div>

          <Card className="min-w-0 overflow-hidden border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
            <CardHeader>
              <CardTitle>
                Répartition des {type === "EXPENSE" ? "dépenses" : "revenus"}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              {categories.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Aucune transaction sur cette période.
                </div>
              ) : (
                <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(240px,360px)_minmax(0,1fr)] lg:items-center">
                  <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-auto w-full max-w-[320px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={categories}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={78}
                        outerRadius={118}
                        paddingAngle={3}
                      >
                        {categories.map((category) => (
                          <Cell key={category.id} fill={category.color} />
                        ))}
                        <Label
                          position="center"
                          content={() => (
                            <text
                              x="50%"
                              y="50%"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="fill-white"
                            >
                              <tspan x="50%" dy="-0.2em" className="text-sm font-semibold">
                                {euroFormatter.format(totalAmount)}
                              </tspan>
                              <tspan x="50%" dy="1.6em" className="fill-muted-foreground text-xs">
                                Total
                              </tspan>
                            </text>
                          )}
                        />
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
                      >
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${category.color}20`, color: category.color }}
                        >
                          <CategoryIcon icon={category.icon} className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {category.transactionCount} transaction(s)
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-white">
                            {euroFormatter.format(category.amount)}
                          </p>
                          <p className="text-xs" style={{ color: category.color }}>
                            {Math.round(category.percentage)} %
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {categories.length > 0 && (
            <Card className="min-w-0 overflow-hidden border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
              <CardHeader>
                <CardTitle>Détail par catégorie</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 rounded-lg bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                    <span>Catégorie</span>
                    <span>Transactions</span>
                    <span>Montant</span>
                    <span>Part</span>
                    <span>Tendance</span>
                  </div>
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-white/5 px-4 py-4 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${category.color}20`, color: category.color }}
                        >
                          <CategoryIcon icon={category.icon} className="size-4" />
                        </div>
                        <span className="truncate font-medium text-white">{category.name}</span>
                      </div>
                      <span>{category.transactionCount}</span>
                      <span>{euroFormatter.format(category.amount)}</span>
                      <Badge variant="outline" className="w-fit">
                        {Math.round(category.percentage)} %
                      </Badge>
                      <CategoryTrend category={category} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
