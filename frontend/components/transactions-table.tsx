"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Calendar, Search, Pencil, Trash2 } from "lucide-react"
import { TransactionDialog } from "@/components/transaction-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  type: "INCOME" | "EXPENSE" | "TRANSFER"
  category: string
  categoryId: string | null
  accountId: string | null
  destinationAccountId: string | null
  account: { id: string; name: string } | null
  destinationAccount: { id: string; name: string } | null
  date: string
}

type Account = {
  id: string
  name: string
}

type AccountsResponse = {
  accounts: Account[]
}

type TransactionTypeFilter = "ALL" | Transaction["type"]

const transactionGridClassName =
  "grid grid-cols-[112px_minmax(180px,1fr)_minmax(280px,1.35fr)_160px_132px_96px] gap-x-6"

function getLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDateInputParts(value: string) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split("-").map(Number)

  if (!year || !month || !day) {
    return null
  }

  return { year, month, day }
}

function formatDateInputValue(value: string) {
  const parts = getDateInputParts(value)

  if (!parts) {
    return ""
  }

  return [
    String(parts.day).padStart(2, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.year),
  ].join("/")
}

function isValidDateParts(day: number, month?: number, year?: number) {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false
  }

  if (month === undefined) {
    return true
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false
  }

  if (year === undefined) {
    const maxDaysByMonth = [
      31,
      29,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ]
    const lastDayOfMonth = maxDaysByMonth[month - 1]

    return day <= lastDayOfMonth
  }

  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return false
  }

  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function parseDateSearch(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return {
      isActive: false,
      isValid: true,
    }
  }

  if (!/^\d{1,2}(?:\/\d{1,2})?(?:\/\d{4})?$/.test(normalizedValue)) {
    return {
      isActive: true,
      isValid: false,
    }
  }

  const [dayValue, monthValue, yearValue] = normalizedValue.split("/")
  const day = Number(dayValue)
  const month = monthValue ? Number(monthValue) : undefined
  const year = yearValue ? Number(yearValue) : undefined

  if (!isValidDateParts(day, month, year)) {
    return {
      isActive: true,
      isValid: false,
    }
  }

  return {
    isActive: true,
    isValid: true,
    day,
    month,
    year,
  }
}

export function TransactionsTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [accountFilter, setAccountFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("")
  const datePickerRef = useRef<HTMLInputElement | null>(null)
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
        const [transactionsResponse, accountsResponse] = await Promise.all([
          fetch("/api/transactions"),
          fetch("/api/accounts"),
        ])

        if (!transactionsResponse.ok) {
          throw new Error("Impossible de charger les transactions.")
        }

        if (!accountsResponse.ok) {
          throw new Error("Impossible de charger les comptes.")
        }

        const transactionsData =
          (await transactionsResponse.json()) as Transaction[]
        const accountsData = (await accountsResponse.json()) as AccountsResponse

        if (isMounted) {
          setTransactions(transactionsData)
          setAccounts(accountsData.accounts)
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

  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Set<string>()

    transactions.forEach((transaction) => {
      if (transaction.category) {
        uniqueCategories.add(transaction.category)
      }
    })

    return Array.from(uniqueCategories).sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory, "fr")
    )
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    const dateSearch = parseDateSearch(dateFilter)

    return transactions.filter((transaction) => {
      const transactionDay = getLocalDayStart(new Date(transaction.date))
      const transactionDateParts = {
        day: transactionDay.getDate(),
        month: transactionDay.getMonth() + 1,
        year: transactionDay.getFullYear(),
      }
      const matchesSearch =
        normalizedSearch.length === 0 ||
        transaction.title.toLowerCase().includes(normalizedSearch)
      const matchesType =
        typeFilter === "ALL" || transaction.type === typeFilter
      const matchesCategory =
        categoryFilter === "ALL" || transaction.category === categoryFilter
      const matchesAccount =
        accountFilter === "ALL" ||
        transaction.accountId === accountFilter ||
        (transaction.type === "TRANSFER" &&
          transaction.destinationAccountId === accountFilter)
      const matchesDate =
        !dateSearch.isActive ||
        (dateSearch.isValid &&
          transactionDateParts.day === dateSearch.day &&
          (dateSearch.month === undefined ||
            transactionDateParts.month === dateSearch.month) &&
          (dateSearch.year === undefined ||
            transactionDateParts.year === dateSearch.year))

      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesAccount &&
        matchesDate
      )
    })
  }, [
    accountFilter,
    categoryFilter,
    dateFilter,
    searchQuery,
    transactions,
    typeFilter,
  ])

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    typeFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    accountFilter !== "ALL" ||
    dateFilter !== ""

  function resetFilters() {
    setSearchQuery("")
    setTypeFilter("ALL")
    setCategoryFilter("ALL")
    setAccountFilter("ALL")
    setDateFilter("")
  }

  function openDatePicker() {
    const datePicker = datePickerRef.current

    if (!datePicker) {
      return
    }

    if (typeof datePicker.showPicker === "function") {
      datePicker.showPicker()
      return
    }

    datePicker.click()
  }

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
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_220px_220px_180px]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher une transaction..."
                className="pl-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as TransactionTypeFilter)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les types</SelectItem>
                <SelectItem value="EXPENSE">Dépense</SelectItem>
                <SelectItem value="INCOME">Revenu</SelectItem>
                <SelectItem value="TRANSFER">Virement interne</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les catégories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous les comptes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les comptes</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-0">
              <Input
                type="text"
                inputMode="numeric"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                placeholder="jj/mm/aaaa"
                aria-label="jj/mm/aaaa"
                className="pr-9"
              />
              <button
                type="button"
                aria-label="Ouvrir le calendrier"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-white"
                onClick={openDatePicker}
              >
                <Calendar className="size-4" />
              </button>
              <input
                ref={datePickerRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute h-px w-px opacity-0"
                onChange={(event) => {
                  setDateFilter(formatDateInputValue(event.target.value))
                }}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardHeader>
          <CardTitle>Liste des transactions</CardTitle>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className={`${transactionGridClassName} rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60`}
              >
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
                transactions.length > 0 &&
                filteredTransactions.length === 0 && (
                  <div className="px-4 py-6 text-sm text-white/60">
                    Aucune transaction ne correspond à vos critères.
                  </div>
                )}

              {!isLoading &&
                filteredTransactions.map((transaction) => {
                  const isActionLoading =
                    actionTransactionId === transaction.id

                  return (
                    <div
                      key={transaction.id}
                      className={`${transactionGridClassName} items-center border-b border-white/5 px-4 py-4`}
                    >
                      <span className="whitespace-nowrap text-white/70">
                        {new Date(transaction.date).toLocaleDateString(
                          "fr-FR"
                        )}
                      </span>

                      <span className="min-w-0 break-words pr-2 font-medium text-white">
                        {transaction.title}
                      </span>

                      <div className="min-w-0 pr-2">
                        {transaction.type === "TRANSFER" ? (
                          <span className="flex w-full max-w-[320px] flex-col items-start gap-0.5 whitespace-normal rounded-md bg-violet-500/10 px-3 py-2 text-sm leading-5 text-violet-300">
                            <span className="max-w-full break-words">
                              {transaction.account?.name ?? "Compte source"}
                            </span>
                            <span className="flex max-w-full items-start gap-1.5 pl-1">
                              <span aria-hidden="true" className="shrink-0">
                                →
                              </span>
                              <span className="min-w-0 break-words">
                                {transaction.destinationAccount?.name ??
                                  "Compte destination"}
                              </span>
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex max-w-full whitespace-normal break-words rounded-md bg-violet-500/10 px-3 py-1 text-sm leading-5 text-violet-300">
                            {transaction.category}
                          </span>
                        )}
                      </div>

                      <span className="whitespace-normal pr-2 text-white/80">
                        {transaction.type === "INCOME"
                          ? "Revenu"
                          : transaction.type === "EXPENSE"
                            ? "Dépense"
                            : "Virement interne"}
                      </span>

                      <span
                        className={`whitespace-nowrap text-right font-semibold ${
                          transaction.type === "INCOME"
                            ? "text-green-400"
                            : transaction.type === "EXPENSE"
                              ? "text-red-400"
                              : "text-cyan-300"
                        }`}
                      >
                        {transaction.type === "INCOME"
                          ? "+"
                          : transaction.type === "EXPENSE"
                            ? "-"
                            : "↔ "}
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
