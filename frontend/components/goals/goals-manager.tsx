/** Coordonne la liste, les filtres et les dialogues sans maintenir de comptabilite locale. */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { GoalCard, type GoalAction } from "@/components/goals/goal-card"
import { GoalDialog } from "@/components/goals/goal-dialog"
import { GoalEntryDialog } from "@/components/goals/goal-entry-dialog"
import { GoalDetailsDialog } from "@/components/goals/goal-details-dialog"
import { GoalsListState, GoalsOverview } from "@/components/goals/goals-overview"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { notifyFinanceChanged, subscribeFinanceChanges } from "@/lib/finance-events"
import type { GoalsResponse, GoalStatus, SavingsGoal } from "@/lib/goals/contracts"
import { goalStatusLabels, isEligibleGoalAccount } from "@/lib/goals/forms"
import { goalErrorMessage, requestGoals } from "@/lib/goals/client"

export function GoalsManager() {
  const [data, setData] = useState<GoalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<GoalStatus | "ALL">("ALL")
  const [selection, setSelection] = useState<{ action: GoalAction | "create"; id?: string } | null>(null)
  const controller = useRef<AbortController | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement | null>(null)
  const load = useCallback(() => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    return requestGoals<GoalsResponse>("/api/goals", { signal: current.signal }).then(next => {
      if (!current.signal.aborted) { setData(next); setError("") }
    }).catch(failure => { if (!current.signal.aborted) setError(goalErrorMessage(failure)) })
      .finally(() => { if (!current.signal.aborted) { setLoading(false); setRefreshing(false) } })
  }, [])
  const refresh = useCallback(() => { setRefreshing(true); void load() }, [load])
  useEffect(() => {
    void load()
    const unsubscribe = subscribeFinanceChanges(refresh)
    return () => { controller.current?.abort(); unsubscribe() }
  }, [load, refresh])

  const selectedGoal = data?.goals.find(goal => goal.id === selection?.id)
  const visible = data?.goals.filter(goal => status === "ALL" || goal.status === status) ?? []
  const canCreate = !!data?.accounts.some(isEligibleGoalAccount)
  const disabled = refreshing || !!error
  function open(next: NonNullable<typeof selection>) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelection(next)
  }
  function close() {
    setSelection(null)
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected && !opener.current.matches(":disabled") ? opener.current : heading.current
      target?.focus()
    })
  }
  function onAction(action: GoalAction, goal: SavingsGoal) { open({ action, id: goal.id }) }
  function saved() { close(); notifyFinanceChanged() }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">Objectifs</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Des enveloppes virtuelles pour vos projets. L’argent reste sur vos comptes, sans modifier vos revenus ni vos dépenses.</p></div>
        <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="icon" aria-label="Actualiser les objectifs" title="Actualiser les objectifs" disabled={refreshing} onClick={refresh}><RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} /></Button><Button disabled={loading || disabled || !canCreate} onClick={() => open({ action: "create" })}><Plus aria-hidden="true" className="size-4" />Nouvel objectif</Button></div>
      </div>
      {data && <GoalsOverview data={data} />}
      {error && data && <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"><p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error} Les données affichées peuvent être anciennes.</p><Button size="sm" variant="outline" onClick={refresh} disabled={refreshing}><RefreshCw aria-hidden="true" className="size-4" />Réessayer</Button></div>}
      <section aria-labelledby="goals-list-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="goals-list-title" className="font-semibold">Vos objectifs{data ? ` (${visible.length})` : ""}</h2><div className="space-y-1.5"><Label htmlFor="goals-filter" className="text-xs text-muted-foreground">Statut</Label>
          <Select value={status} onValueChange={value => setStatus(value as GoalStatus | "ALL")}><SelectTrigger id="goals-filter" className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les statuts</SelectItem>{(["ACTIVE", "PAUSED", "ARCHIVED"] as const).map(value => <SelectItem key={value} value={value}>{goalStatusLabels[value]}</SelectItem>)}</SelectContent></Select>
        </div></div>
        {!!visible.length && <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={refreshing}>{visible.map(goal => <GoalCard key={goal.id} goal={goal} disabled={disabled} onAction={onAction} />)}</div>}
        {!visible.length && <GoalsListState loading={loading} error={!data ? error : ""} filtered={status !== "ALL"} canCreate={canCreate && !disabled} onCreate={() => open({ action: "create" })} onRetry={refresh} />}
      </section>
      {selection?.action === "create" && data && <GoalDialog accounts={data.accounts} onClose={close} onSaved={saved} />}
      {selection?.action === "edit" && selectedGoal && data && <GoalDialog key={`edit:${selectedGoal.id}`} goal={selectedGoal} accounts={data.accounts} onClose={close} onSaved={saved} />}
      {(selection?.action === "allocate" || selection?.action === "release") && selectedGoal && <GoalEntryDialog key={`${selection.action}:${selectedGoal.id}`} goal={selectedGoal} type={selection.action === "allocate" ? "ALLOCATION" : "RELEASE"} onClose={close} onSaved={saved} onRefresh={refresh} />}
      {selection?.action === "detail" && selection.id && <GoalDetailsDialog key={selection.id} id={selection.id} onClose={close} />}
    </div>
  )
}
