"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  PiggyBank,
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
}

type BudgetSummary = {
  monthlyIncome: number
  budgetAllocated: number
  spent: number
  toAllocate: number
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
  return {
    monthlyIncome: 0,
    budgetAllocated: 0,
    spent: 0,
    toAllocate: 0,
  }
}

async function requestBudgets(month: number, year: number) {
  const params = new URLSearchParams({
    month: String(month),
    year: String(year),
  })
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
}: {
  title: string
  value: string
  description: string
  icon: LucideIcon
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardContent className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold text-white">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
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
  const progressWidth = Math.min(budget.percentage, 100)
  const isOverBudget = budget.remaining < 0
  const statusLabel = isOverBudget
    ? `Dépassement de ${formatMoney(Math.abs(budget.remaining))}`
    : `${formatMoney(budget.remaining)} restants`

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

      <CardContent className="min-w-0 space-y-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-white">
              {formatMoney(budget.spent)}
            </span>{" "}
            dépensés sur{" "}
            <span className="font-medium text-white">
              {formatMoney(budget.amount)}
            </span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${
                isOverBudget
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-violet-500 to-cyan-400"
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span
              className={isOverBudget ? "text-red-300" : "text-muted-foreground"}
            >
              {statusLabel}
            </span>
            <span className="font-semibold text-white">
              {Math.round(budget.percentage)} %
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function BudgetsManager() {
  const initialPeriod = getCurrentPeriod()
  const [month, setMonth] = useState(initialPeriod.month)
  const [year, setYear] = useState(initialPeriod.year)
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [summary, setSummary] = useState<BudgetSummary>(getEmptySummary)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [budgetToEdit, setBudgetToEdit] = useState<BudgetItem | null>(null)
  const [budgetToDelete, setBudgetToDelete] = useState<BudgetItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const loadBudgets = useCallback(async () => {
    try {
      setLoadError("")
      const data = await requestBudgets(month, year)

      setBudgets(data.budgets)
      setSummary(data.summary)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les budgets."
      )
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    let isMounted = true

    requestBudgets(month, year)
      .then((data) => {
        if (isMounted) {
          setBudgets(data.budgets)
          setSummary(data.summary)
          setLoadError("")
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les budgets."
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [month, year])

  const isOverAllocated = summary.toAllocate < 0

  function changeMonth(offset: number) {
    const nextPeriod = shiftPeriod(month, year, offset)

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
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <>
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
              Gérez vos limites de dépenses mensuelles.
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

        {loadError ? (
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
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Revenus du mois"
                value={formatMoney(summary.monthlyIncome)}
                description="Transactions de revenu"
                icon={TrendingUp}
              />
              <SummaryCard
                title="Budget alloué"
                value={formatMoney(summary.budgetAllocated)}
                description={getMonthLabel(month, year)}
                icon={Target}
              />
              <SummaryCard
                title="Dépensé"
                value={formatMoney(summary.spent)}
                description="Dépenses budgétées"
                icon={WalletCards}
              />
              <SummaryCard
                title="À répartir"
                value={formatMoney(summary.toAllocate)}
                description={
                  isOverAllocated
                    ? "Budgets supérieurs aux revenus"
                    : "Non affecté aux budgets"
                }
                icon={PiggyBank}
              />
            </div>

            {isOverAllocated && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <TriangleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-red-300"
                  />
                  <p role="alert" className="text-sm text-red-200">
                    Vos budgets dépassent de{" "}
                    <span className="font-semibold">
                      {formatMoney(Math.abs(summary.toAllocate))}
                    </span>{" "}
                    vos revenus du mois.
                  </p>
                </CardContent>
              </Card>
            )}

            <section aria-labelledby="budgets-by-category" className="space-y-4">
              <div>
                <h2
                  id="budgets-by-category"
                  className="text-2xl font-semibold text-white"
                >
                  Budgets par catégorie
                </h2>
                <p className="text-sm text-muted-foreground">
                  Suivez vos limites mensuelles et les dépenses associées.
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
                          {formatMoney(summary.monthlyIncome)}
                        </span>{" "}
                        de revenus à répartir entre vos catégories.
                      </p>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-violet-600 to-cyan-500"
                      onClick={() => {
                        setBudgetToEdit(null)
                        setDialogOpen(true)
                      }}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      Créer un budget
                    </Button>
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
            </section>
          </>
        )}
      </div>
    </>
  )
}
