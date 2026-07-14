"use client"

import { useEffect, useState } from "react"
import { Pie, PieChart, Cell, Label } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type ExpenseCategory = {
  category: string
  amount: number
  percentage: number
}

type DashboardSummary = {
  expenseCategories: ExpenseCategory[]
}

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const chartColors = [
  "#ef4444",
  "#f97316",
  "#8b5cf6",
  "#22c55e",
  "#06b6d4",
  "#64748b",
]

const chartConfig = {
  value: {
    label: "Montant",
  },
} satisfies ChartConfig

function formatEuro(amount: number) {
  return euroFormatter.format(amount)
}

export function ExpenseDistribution() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchExpenseCategories() {
      try {
        const response = await fetch("/api/dashboard/summary")

        if (!response.ok) {
          throw new Error("Impossible de charger la répartition.")
        }

        const data = (await response.json()) as DashboardSummary

        if (isMounted) {
          setCategories(data.expenseCategories)
          setError("")
        }
      } catch {
        if (isMounted) {
          setError("Impossible de charger la répartition.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchExpenseCategories()

    return () => {
      isMounted = false
    }
  }, [])

  const expenseData = categories.map((category, index) => ({
    name: category.category,
    value: category.amount,
    percentage: category.percentage,
    color: chartColors[index % chartColors.length],
  }))
  const total = categories.reduce((sum, item) => sum + item.amount, 0)

  return (
    <Card className="w-full min-w-0 overflow-hidden border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardHeader>
        <CardTitle>Répartition des dépenses</CardTitle>
      </CardHeader>

      <CardContent className="min-w-0 overflow-hidden">
        {isLoading && (
          <p className="text-sm text-white/60">Chargement de la répartition...</p>
        )}

        {!isLoading && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!isLoading && !error && expenseData.length === 0 && (
          <p className="text-sm text-white/60">
            Aucune dépense ce mois-ci.
          </p>
        )}

        {!isLoading && !error && expenseData.length > 0 && (
          <div className="flex min-w-0 flex-col items-center gap-6">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-auto w-full max-w-[190px] shrink-0"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />

                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {expenseData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
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
                        <tspan
                          x="50%"
                          dy="-0.2em"
                          className="text-sm font-semibold"
                        >
                          {formatEuro(total)}
                        </tspan>
                        <tspan
                          x="50%"
                          dy="1.6em"
                          className="fill-muted-foreground text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    )}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {expenseData.map((item) => (
                <div
                  key={item.name}
                  className="min-w-0 rounded-lg bg-white/5 px-3 py-3 text-center"
                >
                  <div className="flex min-w-0 items-center justify-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />

                    <span className="min-w-0 break-words">{item.name}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-medium text-white">
                      {formatEuro(item.value)}
                    </span>

                    <span className="inline-flex min-w-12 justify-center font-medium text-white/80">
                      {Math.round(item.percentage)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
