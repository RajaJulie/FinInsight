/**
 * Pilote la page Budgets : periode choisie, enveloppes, reserve, charges et bilan reel.
 * Recharge les donnees de l'API apres les actions et affiche la repartition sans dupliquer les formules.
 */
"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  EllipsisVertical,
  Pencil,
  PiggyBank,
  Repeat,
  ShieldCheck,
  Plus,
  TrendingUp,
  TriangleAlert,
  Target,
  Trash2,
  type LucideIcon,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import { BudgetDialog, type BudgetItem } from "@/components/budgets/budget-dialog"
import { EmergencyReserveDialog } from "@/components/budgets/emergency-reserve-dialog"
import { MonthlyActualSummarySection } from "@/components/budgets/monthly-actual-summary"
import type { MonthlyActualSummary } from "@/lib/budgets/actual-summary"
import type { CumulativeMonthlyResult } from "@/lib/budgets/cumulative-result"
import { calculateBudgetSummary, type BudgetSummary } from "@/lib/budgets/summary"
import { RecurringSuggestions } from "@/components/recurring-suggestions"
import { RecurringTransactions } from "@/components/recurring-transactions"
import { RecurringPaymentDialog } from "@/components/budgets/recurring-payment-dialog"
import type { PendingRecurringPayment } from "@/lib/recurring/reconciliation"
import type { RecurringPaymentSummary } from "@/lib/budgets/recurring-commitments"
import { subscribeFinanceChanges } from "@/lib/finance-events"
import { CategoryIcon } from "@/components/categories/category-icon"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"

type BudgetsResponse = {
  month: number
  year: number
  summary: BudgetSummary
  budgets: BudgetItem[]
  pendingPayments: PendingRecurringPayment[]
  recurringPayments?: RecurringPaymentSummary[]
  actualSummary?: MonthlyActualSummary
  cumulativeResult?: CumulativeMonthlyResult
}

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
})

function formatMoney(amount: number) {
  return moneyFormatter.format(amount)
}

function getMonthLabel(month: number, year: number) {
  const date = new Date(year, month - 1, 1)
  const label = monthFormatter.format(date)

  return label.charAt(0).toUpperCase() + label.slice(1)
}

function getCurrentPeriod() {
  const now = new Date()

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

function shiftPeriod(month: number, year: number, offset: number) {
  const date = new Date(year, month - 1 + offset, 1)

  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}

function getEmptySummary(): BudgetSummary {
  return calculateBudgetSummary({
    monthlyIncome: 0,
    recurringCommittedTotal: 0,
    budgetAmounts: [],
    spent: 0,
  })
}

async function requestBudgets(month: number, year: number, accountIds: string[] | null) {
  const params = new URLSearchParams({
    month: String(month),
    year: String(year),
  })
  if (accountIds !== null) params.set("accountIds", accountIds.join(","))
  const response = await fetch(`/api/budgets?${params}`)
  const data = (await response.json()) as BudgetsResponse & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message ?? "Impossible de charger les budgets.")
  }

  return data
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  action,
}: {
  title: string
  value: string
  description: string
  icon: LucideIcon
  action?: ReactNode
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardContent className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="break-words text-xl font-semibold text-white">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {action}
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetItem
  onEdit: (budget: BudgetItem) => void
  onDelete: (budget: BudgetItem) => void
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] transition hover:border-violet-500/40">
      <CardHeader className="min-w-0 pb-0">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${budget.category.color}20`,
              color: budget.category.color,
            }}
          >
            <CategoryIcon icon={budget.category.icon} className="size-6" />
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">
              {budget.category.name}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {getMonthLabel(budget.month, budget.year)}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions pour ${budget.category.name}`}
                className="shrink-0"
              >
                <EllipsisVertical aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEdit(budget)}>
                <Pencil aria-hidden="true" className="size-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(budget)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3">
        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">Enveloppe variable</dt>
            <dd className="font-semibold text-white">{formatMoney(budget.amount)}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">Dépenses variables réelles</dt>
            <dd className="font-medium text-white">{formatMoney(budget.spent)}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <dt className="text-muted-foreground">Reste dans l’enveloppe</dt>
            <dd className={`font-semibold ${budget.remaining < 0 ? "text-red-300" : "text-emerald-300"}`}>{formatMoney(budget.remaining)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

export function BudgetsManager() {
  const initialPeriod = getCurrentPeriod()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingRecurringPayment[]>([])
  const [recurringPayments, setRecurringPayments] = useState<RecurringPaymentSummary[]>([])
  const [actualSummary, setActualSummary] = useState<MonthlyActualSummary | null>(null)
  const [cumulativeResult, setCumulativeResult] = useState<CumulativeMonthlyResult | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[] | null>(null)
  const [paymentToConfirm, setPaymentToConfirm] = useState<PendingRecurringPayment | null>(null)
  const [summary, setSummary] = useState<BudgetSummary>(getEmptySummary)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [budgetToEdit, setBudgetToEdit] = useState<BudgetItem | null>(null)
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [reserveToEdit, setReserveToEdit] = useState<{
    month: number
    year: number
    amount: number
  } | null>(null)
  const [recurringVersion, setRecurringVersion] = useState(0)
  const [suggestionsVersion, setSuggestionsVersion] = useState(0)
  const loadSequence = useRef(0)

  const loadBudgets = useCallback(async () => {
    const requestId = ++loadSequence.current
    try {
      setLoadError("")
      const data = await requestBudgets(month, year, selectedAccountIds)
      if (requestId !== loadSequence.current) return

      setBudgets(data.budgets)
      setPendingPayments(data.pendingPayments ?? [])
      setRecurringPayments(data.recurringPayments ?? [])
      setActualSummary(data.actualSummary ?? null)
      setCumulativeResult(data.cumulativeResult ?? null)
      setSummary(data.summary)
      setHasLoaded(true)
    } catch (error) {
      if (requestId !== loadSequence.current) return
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les budgets."
      )
    } finally {
      if (requestId === loadSequence.current) setIsLoading(false)
    }
  }, [month, year, selectedAccountIds])

  useEffect(() => {
    let isMounted = true
    const requestId = ++loadSequence.current

    requestBudgets(month, year, selectedAccountIds)
      .then((data) => {
        if (isMounted && requestId === loadSequence.current) {
          setBudgets(data.budgets)
          setPendingPayments(data.pendingPayments ?? [])
          setRecurringPayments(data.recurringPayments ?? [])
          setActualSummary(data.actualSummary ?? null)
          setCumulativeResult(data.cumulativeResult ?? null)
          setSummary(data.summary)
          setHasLoaded(true)
          setLoadError("")
        }
      })
      .catch((error: unknown) => {
        if (isMounted && requestId === loadSequence.current) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les budgets."
          )
        }
      })
      .finally(() => {
        if (isMounted && requestId === loadSequence.current) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [month, year, selectedAccountIds])

  useEffect(() => subscribeFinanceChanges(() => void loadBudgets()), [loadBudgets])

  const isOverAllocated = summary.freeMoney < 0

  function changeMonth(offset: number) {
    const nextPeriod = shiftPeriod(month, year, offset)
    loadSequence.current += 1
    setIsLoading(true)
    setHasLoaded(false)
    setLoadError("")
    setMonth(nextPeriod.month)
    setYear(nextPeriod.year)
  }

  async function deleteBudget() {
    if (!budgetToDelete) return

    try {
      setIsDeleting(true)
      setDeleteError("")
      const response = await fetch(`/api/budgets/${budgetToDelete.id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? "Impossible de supprimer le budget.")
      }

      toast.success("Budget supprimé avec succès.")
      setBudgetToDelete(null)
      await loadBudgets()
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le budget."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <>
      {paymentToConfirm && <RecurringPaymentDialog key={paymentToConfirm.transactionId} payment={paymentToConfirm} onClose={() => setPaymentToConfirm(null)} onChanged={() => void loadBudgets()} />}
      {reserveToEdit && (
        <EmergencyReserveDialog
          {...reserveToEdit}
          onClose={() => setReserveToEdit(null)}
          onSaved={() => void loadBudgets()}
        />
      )}
      <BudgetDialog
        budget={budgetToEdit}
        open={dialogOpen}
        month={month}
        year={year}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setBudgetToEdit(null)
          }
        }}
        onSaved={() => void loadBudgets()}
      />

      <AlertDialog
        open={budgetToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setBudgetToDelete(null)
            setDeleteError("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce budget ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action retire uniquement la limite mensuelle. Les
              transactions existantes ne seront pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-red-400">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void deleteBudget()
              }}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Budgets</h1>
            <p className="text-muted-foreground">
              Planifiez vos charges, votre réserve et vos budgets variables.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#13223a] bg-white/5 p-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mois précédent"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <div className="min-w-40 text-center font-medium text-white">
                {getMonthLabel(month, year)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mois suivant"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>

            <Button
              className="bg-gradient-to-r from-violet-600 to-cyan-500"
              onClick={() => {
                setBudgetToEdit(null)
                setDialogOpen(true)
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              Nouveau budget
            </Button>
          </div>
        </div>

        {loadError && !hasLoaded ? (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p role="alert" className="text-red-300">
                {loadError}
              </p>
              <Button variant="outline" onClick={() => void loadBudgets()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {loadError && <p role="alert" className="text-sm text-red-300">{loadError} Les dernières données chargées restent affichées.</p>}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Revenus du mois"
                value={formatMoney(summary.monthlyIncome)}
                description="Transactions de revenu"
                icon={TrendingUp}
              />
              <SummaryCard
                title="Charges récurrentes prévues"
                value={formatMoney(summary.recurringCommittedTotal)}
                description={getMonthLabel(month, year)}
                icon={Repeat}
              />
              <SummaryCard
                title="Réserve d'urgence"
                value={formatMoney(summary.emergencyReserve)}
                description="Montant réservé dans votre plan mensuel"
                icon={ShieldCheck}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-0"
                    onClick={() => setReserveToEdit({ month, year, amount: summary.emergencyReserve })}
                  >
                    <Pencil aria-hidden="true" className="size-3" />
                    Modifier
                  </Button>
                }
              />
              <SummaryCard
                title="Disponible pour les budgets"
                value={formatMoney(summary.availableForBudgets)}
                description="Après charges et réserve"
                icon={WalletCards}
              />
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <SummaryCard
                title="Budgets alloués"
                value={formatMoney(summary.variableBudgetAllocated)}
                description="Enveloppes variables"
                icon={Target}
              />
              <SummaryCard
                title="Reste à répartir"
                value={formatMoney(summary.freeMoney)}
                description="Après allocation des budgets variables"
                icon={PiggyBank}
              />
            </div>

            <RecurringSuggestions key={`recurring-suggestions-${suggestionsVersion}`} onConfirmed={() => {
              setRecurringVersion((version) => version + 1)
              void loadBudgets()
            }} />
            <RecurringTransactions key={`recurring-transactions-${recurringVersion}`} month={month} year={year} monthlyPayments={recurringPayments} onChanged={() => void loadBudgets()} onCreated={() => {
              setSuggestionsVersion((version) => version + 1)
              void loadBudgets()
            }} />

            {pendingPayments.length > 0 && (
              <section aria-labelledby="payments-to-reconcile" className="space-y-3">
                <h2 id="payments-to-reconcile" className="text-lg font-semibold">Paiements à rapprocher</h2>
                <p className="text-sm text-muted-foreground">Ces paiements restent dans les dépenses variables tant que leur correspondance n’est pas confirmée.</p>
                <div className="max-h-80 overflow-y-auto divide-y divide-white/10">
                  {pendingPayments.map((payment) => (
                    <div key={payment.transactionId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1"><p className="break-words font-medium">{payment.title}</p><p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(payment.date))} · {formatMoney(payment.amount)}</p></div>
                      <Button variant="outline" size="sm" onClick={() => setPaymentToConfirm(payment)}>Rapprocher</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isOverAllocated && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-red-300"
                  />
                  <p role="alert" className="text-sm text-red-200">
                    Votre plan mensuel dépasse vos revenus de{" "}
                    <span className="font-semibold">
                      {formatMoney(Math.abs(summary.freeMoney))}
                    </span>{" "}
                    (charges, réserve et budgets variables).
                  </p>
                </CardContent>
              </Card>
            )}

            <section
              aria-labelledby="budget-allocation-heading"
              className="min-w-0 space-y-3 border-y border-white/10 py-4"
            >
              <h2
                id="budget-allocation-heading"
                className="text-base font-semibold text-white"
              >
                Répartition des budgets
              </h2>
              <dl className="max-w-lg space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Disponible pour les budgets</dt>
                  <dd className="shrink-0 tabular-nums text-white">
                    {formatMoney(summary.availableForBudgets)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-muted-foreground">Budgets déjà alloués</dt>
                  <dd className="shrink-0 tabular-nums text-white">
                    {summary.variableBudgetAllocated > 0 && "-"}
                    {formatMoney(summary.variableBudgetAllocated)}
                  </dd>
                </div>
                <div
                  className="flex items-start justify-between gap-4 border-t border-white/10 pt-3"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <dt className="font-medium text-white">
                    {isOverAllocated ? "Surallocation" : "Reste à répartir"}
                  </dt>
                  <dd className="min-w-0 text-right">
                    <span className={`font-semibold tabular-nums ${
                      isOverAllocated ? "text-red-300" : "text-emerald-300"
                    }`}>
                      {formatMoney(isOverAllocated ? Math.abs(summary.freeMoney) : summary.freeMoney)}
                    </span>
                    {isOverAllocated && (
                      <span className="mt-1 block text-xs text-red-300">
                        au-delà du montant disponible
                      </span>
                    )}
                    {summary.freeMoney === 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Tout l&apos;argent disponible a été réparti.
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="budgets-by-category" className="space-y-4">
              <div>
                <h2
                  id="budgets-by-category"
                  className="text-2xl font-semibold text-white"
                >
                  Budgets variables par catégorie
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enveloppes variables et dépenses variables réelles par catégorie.
                </p>
              </div>

              {budgets.length === 0 ? (
                <Card className="border-dashed border-white/10 bg-white/[0.02]">
                  <CardContent className="flex flex-col items-center gap-4 py-10 text-center text-sm text-muted-foreground">
                    <div className="space-y-1">
                      <p>
                        Aucun budget défini pour {getMonthLabel(month, year)}.
                      </p>
                      <p>
                        Vous disposez de{" "}
                        <span className="font-medium text-white">
                          {formatMoney(summary.availableForBudgets)}
                        </span>{" "}
                        disponibles pour les budgets variables.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {budgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      onEdit={(selectedBudget) => {
                        setBudgetToEdit(selectedBudget)
                        setDialogOpen(true)
                      }}
                      onDelete={(selectedBudget) => {
                        setDeleteError("")
                        setBudgetToDelete(selectedBudget)
                      }}
                    />
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 sm:w-auto"
                onClick={() => {
                  setBudgetToEdit(null)
                  setDialogOpen(true)
                }}
              >
                <Plus aria-hidden="true" className="size-4" />
                Ajouter un budget
              </Button>
            </section>
            {actualSummary && (
              <MonthlyActualSummarySection
                summary={actualSummary}
                cumulativeResult={cumulativeResult}
                accountSelection={cumulativeResult?.accountScope && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="max-w-full border-white/15 bg-transparent text-white">
                        <WalletCards className="size-4" aria-hidden="true" />
                        Comptes suivis
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Périmètre du solde disponible</DropdownMenuLabel>
                      {cumulativeResult.accountScope.accounts.map(account => (
                        <DropdownMenuCheckboxItem
                          key={account.id}
                          checked={cumulativeResult.accountScope!.selectedAccountIds.includes(account.id)}
                          disabled={account.currency !== "EUR"}
                          onSelect={event => event.preventDefault()}
                          onCheckedChange={checked => {
                            const current = cumulativeResult.accountScope!.selectedAccountIds
                            const next = checked ? [...current, account.id] : current.filter(id => id !== account.id)
                            loadSequence.current += 1
                            setIsLoading(true)
                            setHasLoaded(false)
                            setSelectedAccountIds(next)
                          }}
                        >
                          <span className="break-words">{account.name}{account.status !== "ACTIVE" ? " (archivé)" : ""}{account.currency !== "EUR" ? ` (${account.currency})` : ""}</span>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                categoryIcons={Object.fromEntries(budgets.map(budget => [budget.category.id, budget.category.icon]))}
                periodLabel={getMonthLabel(month, year)}
                completed={year < initialPeriod.year || (year === initialPeriod.year && month < initialPeriod.month)}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
