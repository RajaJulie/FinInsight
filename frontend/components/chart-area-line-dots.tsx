"use client"

import { Area, AreaChart, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type AnnualChartPoint = {
  month: string
  income: number
  expense: number
}

type DailyBalancePoint = {
  date: string
  balance: number
}

type ChartPoint = {
  month?: string
  date?: string
  income?: number
  expense?: number
  balance?: number
}

export type BalanceChartData =
  | {
      mode: "annual"
      year: number
      data: AnnualChartPoint[]
    }
  | {
      mode: "monthly"
      year: number
      month: number
      openingBalance: number
      data: DailyBalancePoint[]
    }

const chartConfig = {
  income: {
    label: "Revenus",
    color: "#22c55e",
  },
  expense: {
    label: "Dépenses",
    color: "#ef4444",
  },
  balance: {
    label: "Solde",
    color: "#8b5cf6",
  },
} satisfies ChartConfig

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
})

const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
})

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)

  return monthFormatter.format(new Date(year, monthNumber - 1, 1))
}

function formatDay(date: string) {
  const [year, month, day] = date.split("-").map(Number)

  return dayFormatter.format(new Date(year, month - 1, day))
}

export function ChartAreaLinear({ chart }: { chart: BalanceChartData }) {
  const isAnnual = chart.mode === "annual"
  const data: ChartPoint[] = chart.data

  return (
    <ChartContainer
      config={chartConfig}
      className="h-full w-full min-w-0"
    >
      <AreaChart
        data={data}
        margin={{
          top: 8,
          right: 4,
          left: 0,
          bottom: 4,
        }}
      >
        <defs>
          <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey={isAnnual ? "month" : "date"}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          tick={{ fontSize: 10 }}
          minTickGap={12}
          tickFormatter={isAnnual ? formatMonth : formatDay}
        />

        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(value) =>
                isAnnual
                  ? formatMonth(String(value))
                  : formatDay(String(value))
              }
              formatter={(value, name) => (
                <div className="flex min-w-32 items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === "income"
                      ? "Revenus"
                      : name === "expense"
                        ? "Dépenses"
                        : "Solde"}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {euroFormatter.format(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />

        {isAnnual ? (
          <>
            <Area
              dataKey="income"
              type="linear"
              fill="url(#fillIncome)"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 2, fill: "#22c55e", stroke: "#22c55e" }}
            />
            <Area
              dataKey="expense"
              type="linear"
              fill="url(#fillExpense)"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 2, fill: "#ef4444", stroke: "#ef4444" }}
            />
          </>
        ) : (
          <Area
            dataKey="balance"
            type="linear"
            fill="url(#fillBalance)"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
          />
        )}
      </AreaChart>
    </ChartContainer>
  )
}
