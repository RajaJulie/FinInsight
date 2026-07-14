"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"

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

const categoryImages: Record<string, string> = {
  Alimentation: "/categories/Burger.png",
  Transport: "/categories/car.png",
  Loisirs: "/categories/gamepad.png",
  Shopping: "/categories/shopping.png",
  Revenus: "/categories/safe.png",
  Épargne: "/categories/safe.png",
  Santé: "/categories/sante.png",
  Télécommunication: "/categories/telecommunication.png",
  Assurance: "/categories/assurance.png",
  "Frais bancaires": "/categories/frais-bancaires-v3.png",
  "Impôts et taxes": "/categories/impots-taxes.png",
  Autre: "/categories/autre.png",
}

function getCategoryImage(category: string) {
  return categoryImages[category] ?? "/categories/shopping.png"
}

function formatEuro(amount: number) {
  return euroFormatter.format(amount)
}

function getBudgetStatus(percentage: number) {
  if (percentage >= 40) {
    return {
      ringColor: "#ef4444",
      textClass: "text-red-500",
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/30",
      label: "Forte part du mois",
    }
  }

  if (percentage >= 20) {
    return {
      ringColor: "#f97316",
      textClass: "text-orange-400",
      bgClass: "bg-orange-500/10",
      borderClass: "border-orange-500/30",
      label: "Part notable",
    }
  }

  return {
    ringColor: "#22c55e",
    textClass: "text-green-400",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
    label: "Part modérée",
  }
}

export function CategorySection() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchExpenseCategories() {
      try {
        const response = await fetch("/api/dashboard/summary")

        if (!response.ok) {
          throw new Error("Impossible de charger les catégories.")
        }

        const data = (await response.json()) as DashboardSummary

        if (isMounted) {
          setCategories(data.expenseCategories)
          setError("")
        }
      } catch {
        if (isMounted) {
          setError("Impossible de charger les catégories.")
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

  return (
    <section className="mx-4 min-w-0 overflow-hidden rounded-2xl border border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] p-4 lg:mx-6">
      <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 break-words text-xl font-semibold text-white">Mes catégories</h2>

        <button className="text-sm text-violet-400 hover:text-violet-300">
          Voir toutes
        </button>
      </div>

      {isLoading && (
        <p className="text-sm text-white/60">Chargement des catégories...</p>
      )}

      {!isLoading && error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {!isLoading && !error && categories.length === 0 && (
        <p className="text-sm text-white/60">
          Aucune dépense ce mois-ci.
        </p>
      )}

      <div className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
        {!isLoading && !error && categories.map((category) => {
          const percentage = Math.round(category.percentage)
          const status = getBudgetStatus(percentage)
          const isBankFees = category.category === "Frais bancaires"

          return (
            <Card
              key={category.category}
              className="w-full min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] p-4 text-center"
            >
              <div className="relative mx-auto flex aspect-square w-full max-w-36 items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      ${status.ringColor} ${Math.min(percentage, 100)}%,
                      rgba(255,255,255,0.12) 0
                    )`,
                  }}
                />

                <div className="absolute inset-[10px] rounded-full bg-[#071226]" />

                <div
                  className="absolute inset-[20px] rounded-full blur-xl"
                  style={{
                    backgroundColor: `${status.ringColor}20`,
                  }}
                />

                <Image
                  src={getCategoryImage(category.category)}
                  alt={category.category}
                  width={isBankFees ? 128 : 112}
                  height={isBankFees ? 128 : 112}
                  className={`relative z-10 h-auto object-contain ${
                    isBankFees ? "w-[90%]" : "w-[78%]"
                  }`}
                />
              </div>

              <p className={`mt-4 break-words text-xl font-bold ${status.textClass}`}>
                {formatEuro(category.amount)}
              </p>

              <p className="mt-2 text-sm text-white/70">
                {percentage}% des dépenses
              </p>

              <div
                className={`mt-4 flex min-w-0 flex-wrap items-center justify-center gap-2 break-words rounded-lg border px-3 py-2 text-center text-sm ${status.borderClass} ${status.bgClass} ${status.textClass}`}
              >
                {status.label}
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
