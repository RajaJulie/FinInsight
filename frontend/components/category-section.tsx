import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

const categories = [
  {
    name: "Alimentation",
    image: "/categories/Burger.png",
    spent: 510,
    budget: 400,
    color: "red",
    ringColor: "#ef4444",
    status: "Budget dépassé",
  },
  {
    name: "Transport",
    image: "/categories/car.png",
    spent: 120,
    budget: 300,
    color: "orange",
    ringColor: "#f97316",
  },
  {
    name: "Loisirs",
    image: "/categories/gamepad.png",
    spent: 90,
    budget: 150,
    color: "orange",
    ringColor: "#f97316",
  },
  {
    name: "Épargne",
    image: "/categories/safe.png",
    spent: 200,
    budget: 500,
    color: "green",
    ringColor: "#22c55e",
  },
  {
    name: "Shopping",
    image: "/categories/shopping.png",
    spent: 160,
    budget: 250,
    color: "orange",
    ringColor: "#f97316",
  },
]

export function CategorySection() {
  return (
    <section
      className="
        rounded-2xl
        border border-[#13223a]
        bg-gradient-to-t
        from-[#071226]
        to-[#0b1d3a]
        p-6
      "
    >
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Mes catégories
        </h2>

        <button className="text-sm text-violet-400 hover:text-violet-300">
          Voir toutes
        </button>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {categories.map((category) => {
          const percentage = Math.round(
            (category.spent / category.budget) * 100
          )

          return (
            <Card
              key={category.name}
              className="
                border-[#13223a]
                bg-gradient-to-t
                from-[#071226]
                to-[#0b1d3a]
                p-4
                text-center
              "
            >
              {/* Cercle progressif */}
              <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
                {/* Anneau */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      ${category.ringColor} ${Math.min(percentage, 100)}%,
                      rgba(255,255,255,0.12) 0
                    )`,
                  }}
                />

                {/* Centre */}
                <div className="absolute inset-[10px] rounded-full bg-[#071226]" />

                {/* Glow */}
                <div
                  className="absolute inset-[20px] rounded-full blur-xl"
                  style={{
                    backgroundColor: `${category.ringColor}20`,
                  }}
                />

                {/* Image */}
                <img
                  src={category.image}
                  alt={category.name}
                  className="relative z-10 h-28 w-28 object-contain"
                />
              </div>

              <p
                className={`mt-4 text-xl font-bold ${
                  category.color === "red"
                    ? "text-red-500"
                    : category.color === "green"
                    ? "text-green-400"
                    : "text-orange-400"
                }`}
              >
                {category.spent} €
                <span className="text-white">
                  {" "}
                  / {category.budget} €
                </span>
              </p>

              <p className="mt-2 text-sm text-white/70">
                {percentage}% du budget
              </p>

              {category.status && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  {category.status}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Button variant="outline">
          Voir toutes les catégories
        </Button>
      </div>
    </section>
  )
}