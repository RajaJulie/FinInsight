"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const transactions = [
  {
    date: "Aujourd'hui 12:45",
    description: "Uber Eats",
    category: "Alimentation",
    amount: "-24,50 €",
    categoryColor: "bg-red-500/10 text-red-400",
    amountColor: "text-white",
  },
  {
    date: "Aujourd'hui 11:32",
    description: "Carrefour",
    category: "Alimentation",
    amount: "-65,80 €",
    categoryColor: "bg-red-500/10 text-red-400",
    amountColor: "text-white",
  },
  {
    date: "Aujourd'hui 08:30",
    description: "Salaire",
    category: "Revenus",
    amount: "+2 400,00 €",
    categoryColor: "bg-green-500/10 text-green-400",
    amountColor: "text-green-400",
  },
  {
    date: "Hier 22:15",
    description: "Netflix",
    category: "Loisirs",
    amount: "-13,99 €",
    categoryColor: "bg-violet-500/10 text-violet-400",
    amountColor: "text-white",
  },
  {
    date: "Hier 18:20",
    description: "TotalEnergies",
    category: "Transport",
    amount: "-45,00 €",
    categoryColor: "bg-orange-500/10 text-orange-400",
    amountColor: "text-white",
  },
]

export function TransactionsSection() {
  return (
    <div className=" *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-[#071226] *:data-[slot=card]:to-[#0b1d3a] *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-2 dark:*:data-[slot=card]:bg-card">

    
    <Card
      className="
        @container/card
      "
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Transactions récentes
          </CardTitle>

          <Button variant="ghost" size="sm" className="text-violet-400 hover:text-violet-300">
            Voir toutes
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* En-tête */}
        <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr] rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
          <span>Date</span>
          <span>Description</span>
          <span>Catégorie</span>
          <span className="text-right">Montant</span>
        </div>

        {/* Transactions */}
        {transactions.map((transaction) => (
          <div
            key={`${transaction.description}-${transaction.date}`}
            className="grid grid-cols-[2fr_2fr_1.5fr_1fr] items-center border-b border-white/5 px-4 py-4"
          >
            <div className="text-white/60">
              {transaction.date}
            </div>

            <div className="text-white font-medium">
              {transaction.description}
            </div>

            <div>
              <span
                className={`rounded-md px-3 py-1 text-sm ${transaction.categoryColor}`}
              >
                {transaction.category}
              </span>
            </div>

            <div
              className={`text-right font-semibold ${transaction.amountColor}`}
            >
              {transaction.amount}
            </div>
          </div>
        ))}
      </CardContent>

      <CardFooter className="justify-center">
        <Button variant="outline">
          Voir toutes les transactions
        </Button>
      </CardFooter>
    </Card>
    </div>
  )
}