"use client"

import { notifyFinanceChanged, subscribeFinanceChanges } from "@/lib/finance-events"
import { buildAccountBalanceHistory, compareTransactionsChronologically } from "@/lib/accounts/history"
import { useActiveTransaction } from "@/hooks/use-active-transaction"
import { TransactionBalancePanel } from "@/components/transactions/transaction-balance-panel"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
  createdAt?: string
}

type Account = {
  id: string
  name: string
  initialBalance: number
  type: string
  status: string
  currency: string
}

type AccountsResponse = {
  accounts: Account[]
}

type TransactionTypeFilter = "ALL" | Transaction["type"]

const transactionGridClassName =
  "md:grid-cols-[112px_minmax(180px,1fr)_minmax(240px,1.35fr)_140px_132px_96px] md:gap-x-5"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" })

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedAccountId = searchParams.get("accountId") || null
  const accountFilter = requestedAccountId
    ? `ACCOUNT:${requestedAccountId}`
    : searchParams.get("accountView") === "all" ? "ALL_ACCOUNTS" : "ALL"
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("ALL")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("")
  const [chronologicalOrder, setChronologicalOrder] = useState("DESC")
  const datePickerRef = useRef<HTMLInputElement | null>(null)
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null)
  const [actionTransactionId, setActionTransactionId] = useState<string | null>(
    null
  )
  const [error, setError] = useState("")
  const [deleteError, setDeleteError] = useState("")

  function setAccountFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("accountId")
    params.delete("accountView")
    if (value.startsWith("ACCOUNT:")) params.set("accountId", value.slice("ACCOUNT:".length))
    if (value === "ALL_ACCOUNTS") params.set("accountView", "all")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    let isMounted = true
    let sequence = 0

    async function fetchTransactions() {
      const requestId = ++sequence
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

        if (isMounted && requestId === sequence) {
          setTransactions(transactionsData)
          setAccounts(accountsData.accounts)
          setError("")
        }
      } catch {
        if (isMounted && requestId === sequence) {
          setError("Impossible de charger les transactions.")
        }
      } finally {
        if (isMounted && requestId === sequence) {
          setIsLoading(false)
        }
      }
    }

    void fetchTransactions()
    const unsubscribe = subscribeFinanceChanges(() => void fetchTransactions())

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const balanceHistory = useMemo(() => buildAccountBalanceHistory({
    accounts,
    transactions,
    selectedAccountIds: accountFilter === "ALL" ? undefined
      : accountFilter === "ALL_ACCOUNTS" ? accounts.filter(account => account.currency === "EUR").map(account => account.id)
      : accounts.some(account => account.id === requestedAccountId && account.currency === "EUR") ? [requestedAccountId!] : [],
  }), [accounts, transactions, accountFilter, requestedAccountId])
  const balancesAfter = useMemo(() => new Map(balanceHistory.entries.map(entry => [entry.transactionId, entry.afterCents / 100])), [balanceHistory])
  const selectedAccountNames = accounts.filter(account => balanceHistory.selectedAccountIds.includes(account.id)).map(account => account.name).join(" + ")
  const missingRequestedAccount = requestedAccountId !== null && !accounts.some(account => account.id === requestedAccountId)
  const unavailableRequestedAccount = !isLoading && !error && requestedAccountId !== null &&
    !accounts.some(account => account.id === requestedAccountId && account.currency === "EUR")

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
      const transactionDay = new Date(transaction.date)
      const transactionDateParts = {
        day: transactionDay.getUTCDate(),
        month: transactionDay.getUTCMonth() + 1,
        year: transactionDay.getUTCFullYear(),
      }
      const matchesSearch =
        normalizedSearch.length === 0 ||
        transaction.title.toLowerCase().includes(normalizedSearch)
      const matchesType =
        typeFilter === "ALL" || transaction.type === typeFilter
      const matchesCategory =
        categoryFilter === "ALL" || transaction.category === categoryFilter
      const matchesAccount = balancesAfter.has(transaction.id)
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
    }).sort((first, second) => chronologicalOrder === "ASC"
      ? compareTransactionsChronologically(first, second)
      : compareTransactionsChronologically(second, first))
  }, [
    balancesAfter,
    chronologicalOrder,
    categoryFilter,
    dateFilter,
    searchQuery,
    transactions,
    typeFilter,
  ])

  const visibleTransactionIds = useMemo(() => filteredTransactions.map(transaction => transaction.id), [filteredTransactions])
  const { listRef, panelRef, activeId, focusTransaction, activateFocusedTransaction } = useActiveTransaction(visibleTransactionIds, accountFilter)
  const activeIndex = filteredTransactions.findIndex(transaction => transaction.id === activeId)
  const activeTransaction = activeIndex >= 0 ? filteredTransactions[activeIndex] : null

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
      notifyFinanceChanged()
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

      <Card className="min-w-0 bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_180px_220px_160px]">
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Rechercher une transaction..."
                aria-label="Rechercher une transaction"
                className="pl-9"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as TransactionTypeFilter)
              }
            >
              <SelectTrigger className="w-full" aria-label="Type de transaction">
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
              <SelectTrigger className="w-full" aria-label="Catégorie de transaction">
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
              <SelectTrigger className="w-full" aria-label="Compte ou vue combinée">
                <SelectValue placeholder={requestedAccountId ? "Chargement du compte..." : "Combiné"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Combiné</SelectItem>
                <SelectItem value="ALL_ACCOUNTS">Tous les comptes</SelectItem>
                {missingRequestedAccount && (
                  <SelectItem value={accountFilter} disabled>{isLoading ? "Chargement du compte..." : "Compte indisponible"}</SelectItem>
                )}
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={`ACCOUNT:${account.id}`} disabled={account.currency !== "EUR"}>
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

      <section className="relative min-w-0 space-y-4" aria-label="Historique des transactions">
      <TransactionBalancePanel
        panelRef={panelRef}
        transaction={activeTransaction}
        amount={activeTransaction ? balancesAfter.get(activeTransaction.id) ?? null : null}
        scopeLabel={selectedAccountNames}
        loading={isLoading}
        onPrevious={activeIndex > 0 ? () => focusTransaction(visibleTransactionIds[activeIndex - 1]) : undefined}
        onNext={activeIndex >= 0 && activeIndex < visibleTransactionIds.length - 1 ? () => focusTransaction(visibleTransactionIds[activeIndex + 1]) : undefined}
      />
      <Card className="min-w-0 bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Liste des transactions</CardTitle>
            <Select value={chronologicalOrder} onValueChange={setChronologicalOrder}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Ordre des transactions"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">Plus récentes d’abord</SelectItem>
                <SelectItem value="ASC">Plus anciennes d’abord</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="break-words text-sm text-white/70">{selectedAccountNames || (unavailableRequestedAccount ? "Compte indisponible" : "Aucun compte disponible")}</p>
          {unavailableRequestedAccount && <p role="alert" className="text-sm text-amber-200">Ce compte est introuvable ou indisponible. Sélectionnez un autre compte ou la vue Tous les comptes.</p>}
          <details className="text-xs leading-relaxed text-white/70">
            <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2">Comprendre les soldes affichés</summary>
            <p className="mt-2">Soldes calculés à partir des soldes initiaux enregistrés et de toutes les opérations disponibles, avant les filtres. Historique non rapproché avec la banque ; les périodes antérieures à la première opération ne sont pas reconstituées.</p>
            <p className="mt-2">À date identique, les opérations sont ordonnées par date de création puis identifiant. Cet ordre technique ne garantit pas l’ordre d’exécution bancaire.</p>
          </details>
          <p className="text-xs text-amber-200">Soldes calculés, non vérifiés auprès de la banque.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <div className="md:min-w-[1080px]">
              <div
                className={`${transactionGridClassName} hidden rounded-lg bg-white/5 px-4 py-3 text-sm text-white/60 md:grid`}
              >
                <span>Date</span>
                <span>Description</span>
                <span>Catégorie</span>
                <span>Type</span>
                <span className="text-right">Montant</span>
                <span className="text-right">Actions</span>
              </div>

              <div ref={listRef} id="transaction-history" role="list" aria-label="Transactions">
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
                  const isActive = transaction.id === activeId

                  return (
                    <div
                      key={transaction.id}
                      data-transaction-id={transaction.id}
                      role="listitem"
                      tabIndex={0}
                      aria-current={isActive ? "true" : undefined}
                      aria-describedby={isActive ? "transaction-active-balance" : undefined}
                      aria-keyshortcuts="ArrowUp ArrowDown Home End"
                      onFocusCapture={() => activateFocusedTransaction(transaction.id)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return
                        const index = visibleTransactionIds.indexOf(transaction.id)
                        const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1
                          : event.key === "Home" ? 0 : event.key === "End" ? visibleTransactionIds.length - 1 : -1
                        if (next >= 0 && next < visibleTransactionIds.length) {
                          event.preventDefault()
                          focusTransaction(visibleTransactionIds[next])
                        }
                      }}
                      style={{ scrollMarginTop: "var(--balance-scroll-offset, 128px)" }}
                      className={`${transactionGridClassName} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-l-2 px-3 py-4 outline-offset-[-2px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-violet-300 motion-reduce:transition-none md:px-4 ${isActive ? "border-l-violet-400 border-b-white/5 bg-violet-500/10" : "border-l-transparent border-b-white/5"}`}
                    >
                      <span className="col-start-1 row-start-1 whitespace-nowrap text-xs text-white/70 md:col-auto md:row-auto md:text-sm">
                        {dateFormatter.format(new Date(transaction.date))}
                        <span className="md:hidden"> · {transaction.type === "INCOME" ? "Revenu" : transaction.type === "EXPENSE" ? "Dépense" : "Virement"}</span>
                      </span>

                      <span className="col-start-1 row-start-2 min-w-0 break-words pr-2 font-medium text-white md:col-auto md:row-auto">
                        {transaction.title}
                      </span>

                      <div className="col-start-1 row-start-3 min-w-0 pr-2 md:col-auto md:row-auto">
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

                      <span className="hidden whitespace-normal pr-2 text-white/80 md:block">
                        {transaction.type === "INCOME"
                          ? "Revenu"
                          : transaction.type === "EXPENSE"
                            ? "Dépense"
                            : "Virement interne"}
                      </span>

                      <span
                        className={`col-start-2 row-start-2 max-w-[42vw] break-words text-right font-semibold md:col-auto md:row-auto md:max-w-none md:whitespace-nowrap ${
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

                      <div className="col-start-2 row-start-3 flex justify-end gap-2 md:col-auto md:row-auto">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isActionLoading}
                          aria-label={`Modifier ${transaction.title}`}
                          title="Modifier"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={isActionLoading}
                          aria-label={`Supprimer ${transaction.title}`}
                          title="Supprimer"
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
          </div>
        </CardContent>
      </Card>
      </section>
    </>
  )
}
