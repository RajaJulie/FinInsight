"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2 } from "lucide-react"

type Transaction = {
  id: string
  title: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  date: string
}

export function TransactionsTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    async function fetchTransactions() {
      const response = await fetch("/api/transactions")
      const data = await response.json()
      setTransactions(data)
    }

    fetchTransactions()
  }, [])

  return (
    <Card className="bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardHeader>
        <CardTitle>Liste des transactions</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[1.4fr_2fr_1.5fr_1fr_1fr_1fr] rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60">
              <span>Date</span>
              <span>Description</span>
              <span>Catégorie</span>
              <span>Type</span>
              <span className="text-right">Montant</span>
              <span className="text-right">Actions</span>
            </div>

            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[1.4fr_2fr_1.5fr_1fr_1fr_1fr] items-center border-b border-white/5 px-4 py-4"
              >
                <span className="text-white/70">
                  {new Date(transaction.date).toLocaleDateString("fr-FR")}
                </span>

                <span className="font-medium text-white">
                  {transaction.title}
                </span>

                <span className="w-fit rounded-md bg-violet-500/10 px-3 py-1 text-sm text-violet-300">
                  {transaction.category}
                </span>

                <span className="text-white/80">
                  {transaction.type === "INCOME" ? "Revenu" : "Dépense"}
                </span>

                <span
                  className={`text-right font-semibold ${
                    transaction.type === "INCOME"
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {transaction.type === "INCOME" ? "+" : "-"}
                  {transaction.amount.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="icon">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}