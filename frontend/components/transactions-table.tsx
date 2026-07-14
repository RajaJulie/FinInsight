"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2 } from "lucide-react"
import { TransactionDialog } from "@/components/transaction-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null)
  const [actionTransactionId, setActionTransactionId] = useState<string | null>(
    null
  )
  const [error, setError] = useState("")
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function fetchTransactions() {
      try {
        const response = await fetch("/api/transactions")

        if (!response.ok) {
          throw new Error("Impossible de charger les transactions.")
        }

        const data = await response.json()

        if (isMounted) {
          setTransactions(data)
          setError("")
        }
      } catch {
        if (isMounted) {
          setError("Impossible de charger les transactions.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchTransactions()

    return () => {
      isMounted = false
    }
  }, [])

  function handleEdit(transaction: Transaction) {
    setSelectedTransaction(transaction)
    setIsEditOpen(true)
  }

  function handleTransactionSaved(transaction: Transaction) {
    setTransactions((currentTransactions) =>
      currentTransactions.map((currentTransaction) =>
        currentTransaction.id === transaction.id
          ? transaction
          : currentTransaction
      )
    )
    setSelectedTransaction(null)
  }

  async function handleDelete() {
    if (!transactionToDelete) {
      return
    }

    try {
      setActionTransactionId(transactionToDelete.id)
      setDeleteError("")

      const response = await fetch(
        `/api/transactions/${transactionToDelete.id}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(
          data.message ?? "Impossible de supprimer la transaction."
        )
      }

      setTransactions((currentTransactions) =>
        currentTransactions.filter(
          (currentTransaction) =>
            currentTransaction.id !== transactionToDelete.id
        )
      )
      setTransactionToDelete(null)
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la transaction."
      )
    } finally {
      setActionTransactionId(null)
    }
  }

  return (
    <>
      <TransactionDialog
        key={selectedTransaction?.id ?? "edit-transaction"}
        transaction={selectedTransaction}
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)

          if (!open) {
            setSelectedTransaction(null)
          }
        }}
        onSaved={handleTransactionSaved}
        trigger={null}
      />

      <AlertDialog
        open={transactionToDelete !== null}
        onOpenChange={(open) => {
          if (!open && actionTransactionId === null) {
            setTransactionToDelete(null)
            setDeleteError("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Voulez-vous vraiment supprimer cette transaction ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p role="alert" className="text-sm text-red-500">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionTransactionId !== null}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={actionTransactionId !== null}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {actionTransactionId !== null ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardHeader>
          <CardTitle>Liste des transactions</CardTitle>
          {error && <p className="text-sm text-red-400">{error}</p>}
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

              {isLoading && (
                <div className="px-4 py-6 text-sm text-white/60">
                  Chargement des transactions...
                </div>
              )}

              {!isLoading && transactions.length === 0 && (
                <div className="px-4 py-6 text-sm text-white/60">
                  Aucune transaction pour le moment.
                </div>
              )}

              {!isLoading &&
                transactions.map((transaction) => {
                  const isActionLoading =
                    actionTransactionId === transaction.id

                  return (
                    <div
                      key={transaction.id}
                      className="grid grid-cols-[1.4fr_2fr_1.5fr_1fr_1fr_1fr] items-center border-b border-white/5 px-4 py-4"
                    >
                      <span className="text-white/70">
                        {new Date(transaction.date).toLocaleDateString(
                          "fr-FR"
                        )}
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
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isActionLoading}
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isActionLoading}
                          onClick={() => {
                            setTransactionToDelete(transaction)
                            setDeleteError("")
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
