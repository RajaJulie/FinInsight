import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

const categories = [
  {
    name: "Alimentation",
    image: "/categories/Burger.png",
    spent: 510,
    budget: 400,
  },
  {
    name: "Transport",
    image: "/categories/car.png",
    spent: 320,
    budget: 350,
  },
  {
    name: "Loisirs",
    image: "/categories/gamepad.png",
    spent: 190,
    budget: 200,
  },
  {
    name: "Épargne",
    image: "/categories/safe.png",
    spent: 720,
    budget: 1000,
  },
  {
    name: "Shopping",
    image: "/categories/shopping.png",
    spent: 460,
    budget: 500,
  },
]

function getBudgetStatus(percentage: number) {
  if (percentage >= 100) {
    return {
      ringColor: "#ef4444",
      textClass: "text-red-500",
      bgClass: "bg-red-500/10",
      borderClass: "border-red-500/30",
      label: "Budget dépassé",
      isDanger: true,
    }
  }

  if (percentage >= 80) {
    return {
      ringColor: "#f97316",
      textClass: "text-orange-400",
      bgClass: "bg-orange-500/10",
      borderClass: "border-orange-500/30",
      label: "Presque atteint",
      isDanger: false,
    }
  }

  return {
    ringColor: "#22c55e",
    textClass: "text-green-400",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
    label: "Budget maîtrisé",
    isDanger: false,
  }
}

export function CategorySection() {
  return (
    <section className="mx-auto w-full max-w-[calc(100%-48px)] rounded-2xl border border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] p-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Mes catégories</h2>

        <button className="text-sm text-violet-400 hover:text-violet-300">
          Voir toutes
        </button>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {categories.map((category) => {
          const percentage = Math.round(
            (category.spent / category.budget) * 100
          )

          const status = getBudgetStatus(percentage)

          return (
            <Card
              key={category.name}
              className="border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] p-4 text-center"
            >
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
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

                <img
                  src={category.image}
                  alt={category.name}
                  className="relative z-10 h-28 w-28 object-contain"
                />
              </div>

              <p className={`mt-4 text-xl font-bold ${status.textClass}`}>
                {category.spent} €
                <span className="text-white"> / {category.budget} €</span>
              </p>

              <p className="mt-2 text-sm text-white/70">
                {percentage}% du budget
              </p>

              <div
                className={`mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm ${status.borderClass} ${status.bgClass} ${status.textClass}`}
              >
                {status.isDanger && <AlertTriangle className="h-4 w-4" />}
                {status.label}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="outline">Voir toutes les catégories</Button>
      </div>
    </section>
  )
}