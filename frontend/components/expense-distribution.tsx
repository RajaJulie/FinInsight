"use client"

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

const expenseData = [
  { name: "Alimentation", value: 510, color: "#ef4444" },
  { name: "Transport", value: 320, color: "#f97316" },
  { name: "Loisirs", value: 190, color: "#8b5cf6" },
  { name: "Autres", value: 660, color: "#64748b" },
]

const total = expenseData.reduce((sum, item) => sum + item.value, 0)

const chartConfig = {
  value: {
    label: "Montant",
  },
} satisfies ChartConfig

export function ExpenseDistribution() {
  return (
    <Card className="border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardHeader>
        <CardTitle>Répartition des dépenses</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center"> 
        <ChartContainer
        config={chartConfig}
        className="mx-auto h-[190px] w-[190px] shrink-0"
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
                      className="text-xl font-semibold"
                    >
                      {total} €
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

        <div className="flex-1 space-y-4">
        {expenseData.map((item) => {
            const percentage = Math.round((item.value / total) * 100)

            return (
            <div
                key={item.name}
                className="grid grid-cols-[1fr_70px_70px] items-center gap-5"
            >
                <div className="flex items-center gap-3">
                <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                />

                <span>{item.name}</span>
                </div>

                <span className="text-right font-medium text-white">
                    {item.value}€
                </span>

                <span className="font-medium">
                {percentage}%
                </span>
            </div>
            )
        })}
        </div>
        </div>
      </CardContent>
    </Card>
  )
}