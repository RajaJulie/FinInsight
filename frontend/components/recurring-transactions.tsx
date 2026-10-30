"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, Check, CirclePause, CirclePlay, Pencil, Plus, WalletCards } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RecurringChargeDialog } from "@/components/recurring-charge-dialog"
import {
  getRecurringStatusActionLabel,
  getRecurringStatusErrorMessage,
  getRecurringStatusLabel,
  getRecurringStatusPatchPayload,
  replaceRecurringTransactionById,
} from "@/lib/recurring/status"
import { formatFrenchDate } from "@/lib/recurring/date-period"
import { notifyFinanceChanged, subscribeFinanceChanges } from "@/lib/finance-events"
import { type RecurringChargeData } from "@/lib/recurring/charge-form"
import type { RecurringPaymentSummary } from "@/lib/budgets/recurring-commitments"

type RecurringTransaction = RecurringChargeData

type RecurringTransactionsResponse = {
  recurringTransactions: RecurringTransaction[]
  message?: string
}

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

function getFrequencyLabel(frequency: RecurringTransaction["frequency"]) {
  return frequency === "MONTHLY" ? "mois" : "mois"
}

async function requestRecurringTransactions(signal?: AbortSignal) {
  const response = await fetch("/api/recurring-transactions", { signal })
  const data = (await response.json()) as RecurringTransactionsResponse

  if (!response.ok) {
    throw new Error(data.message ?? "Impossible de charger les charges récurrentes.")
  }

  return data.recurringTransactions
}

export function RecurringTransactions({ onChanged, onCreated, month, year, monthlyPayments = [] }: { onChanged?: () => void; onCreated?: () => void; month: number; year: number; monthlyPayments?: RecurringPaymentSummary[] }) {
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransaction[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [patchError, setPatchError] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCharge, setEditingCharge] = useState<RecurringTransaction | null>(null)

  const loadRecurringTransactions = useCallback(async (signal?: AbortSignal) => {
    try {
      const items = await requestRecurringTransactions(signal)

      setRecurringTransactions(items)
      setError("")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      setError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les charges récurrentes."
      )
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => subscribeFinanceChanges(() => void loadRecurringTransactions()), [loadRecurringTransactions])

  useEffect(() => {
    const controller = new AbortController()

    requestRecurringTransactions(controller.signal)
      .then((items) => {
        setRecurringTransactions(items)
        setError("")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setError(
          error instanceof Error
            ? error.message
            : "Impossible de charger les charges récurrentes."
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  async function toggleRecurringTransaction(item: RecurringTransaction) {
    if (updatingId !== null) return

    const nextActive = !item.active

    try {
      setUpdatingId(item.id)
      setPatchError("")

      const response = await fetch(`/api/recurring-transactions/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(getRecurringStatusPatchPayload(nextActive)),
      })
      const data = (await response.json()) as {
        message?: string
        recurringTransaction?: RecurringTransaction
      }

      if (!response.ok || !data.recurringTransaction) {
        throw new Error(
          getRecurringStatusErrorMessage(response.status, data.message)
        )
      }

      const updatedRecurringTransaction = data.recurringTransaction

      setRecurringTransactions((currentItems) =>
        replaceRecurringTransactionById(
          currentItems,
          updatedRecurringTransaction
        )
      )
      onChanged?.()
      notifyFinanceChanged(false)
    } catch (error) {
      setPatchError(
        error instanceof Error
          ? error.message
          : "Impossible de modifier cette charge récurrente."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card className="border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      {dialogOpen && <RecurringChargeDialog open={dialogOpen} onOpenChange={setDialogOpen} month={month} year={year} onCreated={() => {
        void loadRecurringTransactions()
        onCreated?.()
      }} />}
      {editingCharge && <RecurringChargeDialog key={editingCharge.id} open onOpenChange={(open) => { if (!open) setEditingCharge(null) }} recurringCharge={editingCharge} month={month} year={year} onUpdated={(updated) => {
        setRecurringTransactions((items) => replaceRecurringTransactionById(items, updated))
        void loadRecurringTransactions()
        onChanged?.()
      }} />}
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-white">
              <WalletCards className="size-5 text-violet-300" aria-hidden="true" />
              Charges récurrentes
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Abonnements et charges prévus.
            </p>
          </div>

          {!isLoading && !error && recurringTransactions.length > 0 && (
            <Badge
              variant="outline"
              className="w-fit border-violet-400/25 bg-violet-500/10 text-violet-200"
            >
              {recurringTransactions.length} charge
              {recurringTransactions.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Button variant="outline" className="mb-4 w-full whitespace-normal sm:w-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          Ajouter une charge récurrente
        </Button>
        {isLoading && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 p-4">
                <Skeleton className="mb-4 h-5 w-32" />
                <Skeleton className="mb-2 h-7 w-40" />
                <Skeleton className="mb-5 h-4 w-56" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => void loadRecurringTransactions()}>
              Réessayer
            </Button>
          </div>
        )}

        {!isLoading && !error && recurringTransactions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune charge récurrente enregistrée.
          </p>
        )}

        {!isLoading && !error && recurringTransactions.length > 0 && (
          <div className="space-y-3">
            {patchError && (
              <p role="alert" className="text-sm text-red-400">
                {patchError}
              </p>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recurringTransactions.map((item) => {
                const isUpdating = updatingId === item.id
                const StatusIcon = item.active ? CirclePlay : CirclePause
                const payment = monthlyPayments.find(payment => payment.recurringTransactionId === item.id)

                return (
                  <article
                    key={item.id}
                    className="flex min-w-0 flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-500/40"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold text-white">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-lg font-semibold text-red-300">
                          {euroFormatter.format(item.amount)} /{" "}
                          {getFrequencyLabel(item.frequency)}
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className={
                          item.active
                            ? "border-green-400/25 bg-green-500/10 text-green-300"
                            : "border-white/15 bg-white/5 text-white/70"
                        }
                      >
                        <StatusIcon className="size-3.5" aria-hidden="true" />
                        {getRecurringStatusLabel(item.active)}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-sm text-white/70">
                      <p className="min-w-0 truncate">
                        {item.category.name} • {item.account.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <CalendarClock
                          className="size-4 shrink-0 text-violet-300"
                          aria-hidden="true"
                        />
                        <span>Prélèvement prévu vers le {item.dayOfMonth}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Début : {formatFrenchDate(item.startDate)} · Fin effective :{" "}
                        {formatFrenchDate(item.endDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dernier paiement réel associé : {formatFrenchDate(item.lastPaymentDate ?? null)}
                      </p>
                      {payment && payment.actualAmount !== null && (
                        <div className="space-y-2 border-t border-white/10 pt-2">
                          <Badge variant="outline" className="max-w-full whitespace-normal border-emerald-400/25 text-emerald-300">
                            <Check className="size-3.5 shrink-0" aria-hidden="true" />
                            {payment.transactionIds.length > 1 ? `${payment.transactionIds.length} paiements rapprochés` : "Paiement rapproché"}
                          </Badge>
                          <dl className="space-y-1 text-xs">
                            <div className="flex flex-wrap justify-between gap-x-2"><dt>Prévu ce mois</dt><dd>{euroFormatter.format(payment.plannedAmount)}</dd></div>
                            <div className="flex flex-wrap justify-between gap-x-2"><dt>Réel retenu</dt><dd className="font-semibold text-white">{euroFormatter.format(payment.actualAmount)}</dd></div>
                            <div className="flex flex-wrap justify-between gap-x-2"><dt>Écart</dt><dd className={(payment.difference ?? 0) > 0 ? "text-red-300" : "text-emerald-300"}>{(payment.difference ?? 0) > 0 ? "+" : ""}{euroFormatter.format(payment.difference ?? 0)}</dd></div>
                          </dl>
                        </div>
                      )}
                      {item.activityPeriods && (item.activityPeriods.length > 1 || item.activityPeriods.some(period => period.cancelled)) && (
                        <details className="text-xs text-muted-foreground">
                          <summary className="cursor-pointer">Historique d’activité</summary>
                          <ul className="mt-2 space-y-1">
                            {item.activityPeriods.map(period => (
                              <li key={period.id}>
                                {period.cancelled ? "Annulée avant le début" : `${formatFrenchDate(period.startDate)} → ${period.endDate ? formatFrenchDate(period.endDate) : "en cours"}`}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={updatingId !== null || item.type === "TRANSFER"} onClick={() => setEditingCharge(item)}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant={item.active ? "outline" : "default"}
                        size="sm"
                        disabled={updatingId !== null}
                        onClick={() => void toggleRecurringTransaction(item)}
                      >
                        {isUpdating
                          ? "Modification..."
                          : getRecurringStatusActionLabel(item.active)}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
