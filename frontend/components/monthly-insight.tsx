"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LightbulbIcon } from "lucide-react"

type MonthlyInsightData = {
  category: string | null
  currentAmount: number
  previousAmount: number
  percentageChange: number
  trend: "increase" | "neutral"
  message: string
  advice: string
}

type DashboardSummary = {
  monthlyInsight: MonthlyInsightData
}

export function MonthlyInsight() {
  const [insight, setInsight] = useState<MonthlyInsightData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function fetchMonthlyInsight() {
      try {
        const response = await fetch("/api/dashboard/summary", {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Impossible de charger l’insight du mois.")
        }

        const data: DashboardSummary = await response.json()

        setInsight(data.monthlyInsight)
        setError("")
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }

        setError("Impossible de charger l’insight du mois.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void fetchMonthlyInsight()

    return () => controller.abort()
  }, [])

  const plantImage =
    insight?.trend === "increase"
      ? "/plants/plant-sprout.png"
      : "/plants/plant-healthy.png"

  return (
    <Card className="w-full min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardHeader className="min-w-0">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 break-words">
          <LightbulbIcon className="h-5 w-5 shrink-0 text-white/80" />
          Insight du mois
        </CardTitle>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col items-center gap-4 @[420px]/card:flex-row @[420px]/card:items-center">
          <div className="flex aspect-square w-full max-w-28 shrink-0 items-center justify-center rounded-2xl bg-green-500/10">
            <Image
              src={plantImage}
              alt="Santé financière"
              width={112}
              height={112}
              className="h-auto w-full object-contain"
            />
          </div>

          <div className="min-w-0 space-y-3 break-words text-center text-sm text-muted-foreground @[420px]/card:text-left">
            {isLoading && <p>Analyse de vos dépenses...</p>}

            {!isLoading && error && (
              <p role="alert" className="text-red-400">
                {error}
              </p>
            )}

            {!isLoading && !error && insight && (
              <>
                <p>{insight.message}</p>
                <p>{insight.advice}</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
