/** Charge le detail et son journal chronologique sans deduire de mouvements bancaires. */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react"
import { GoalProgress, GoalWarnings } from "@/components/goals/goal-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { subscribeFinanceChanges } from "@/lib/finance-events"
import type { GoalDetailResponse, SavingsGoalDetail } from "@/lib/goals/contracts"
import { euroFormatter, goalDateFormatter, goalStatusLabels } from "@/lib/goals/forms"
import { goalErrorMessage, requestGoals } from "@/lib/goals/client"

export function GoalHistory({ goal }: { goal: SavingsGoalDetail }) {
  return (
    <section className="space-y-3" aria-labelledby="goal-history-title">
      <h3 id="goal-history-title" className="font-medium">Historique des mouvements virtuels</h3>
      {!goal.entries.length ? <p className="py-4 text-sm text-muted-foreground">Aucune affectation ni libération pour cet objectif.</p> :
        <ol className="max-h-72 divide-y overflow-y-auto pr-2 focus-visible:outline-ring" tabIndex={0} aria-label="Historique chronologique">
          {goal.entries.map(entry => {
            const allocation = entry.type === "ALLOCATION"
            const Icon = allocation ? ArrowDownToLine : ArrowUpFromLine
            return <li key={entry.id} className="flex min-w-0 items-start gap-3 py-3">
              <Icon aria-hidden="true" className={`mt-1 size-4 shrink-0 ${allocation ? "text-violet-400" : "text-sky-500"}`} />
              <div className="min-w-0 flex-1 space-y-1"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{allocation ? "Affectation" : "Libération"}</span><span className="font-semibold tabular-nums">{allocation ? "+" : "−"}{euroFormatter.format(entry.amount)}</span></div>
                <time dateTime={entry.effectiveAt} className="text-xs text-muted-foreground">{goalDateFormatter.format(new Date(entry.effectiveAt))}</time>
                {entry.note && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{entry.note}</p>}
              </div>
            </li>
          })}
        </ol>}
    </section>
  )
}

export function GoalDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [goal, setGoal] = useState<SavingsGoalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  const load = useCallback(() => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    return requestGoals<GoalDetailResponse>(`/api/goals/${encodeURIComponent(id)}`, { signal: current.signal }).then(data => {
      if (!current.signal.aborted) { setGoal(data.goal); setError("") }
    }).catch(failure => { if (!current.signal.aborted) setError(goalErrorMessage(failure)) })
      .finally(() => { if (!current.signal.aborted) setLoading(false) })
  }, [id])
  useEffect(() => {
    void load()
    const unsubscribe = subscribeFinanceChanges(() => { setLoading(true); void load() })
    return () => { controller.current?.abort(); unsubscribe() }
  }, [load])

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Détails de l’objectif</DialogTitle><DialogDescription>Les affectations sont déjà incluses dans le solde du compte. Ce journal n’est pas un relevé bancaire.</DialogDescription></DialogHeader>
        {loading && !goal && <div role="status" aria-label="Chargement de l'objectif" className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /></div>}
        {error && <div className="space-y-3"><p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p><Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }} disabled={loading}><RefreshCw aria-hidden="true" className="size-4" />Réessayer</Button></div>}
        {goal && <div className="min-w-0 space-y-5" aria-busy={loading}>
          <div className="space-y-2"><h2 className="break-words text-lg font-semibold">{goal.title}</h2><p className="break-words text-sm text-muted-foreground">{goal.account.name}</p><Badge variant="outline">{goalStatusLabels[goal.status]}</Badge>{goal.reached && <Badge className="ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Atteint</Badge>}</div>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Cible</dt><dd className="break-words font-semibold">{euroFormatter.format(goal.targetAmount)}</dd></div>
            <div><dt className="text-muted-foreground">Affecté</dt><dd className="break-words font-semibold">{euroFormatter.format(goal.accumulatedAmount)}</dd></div>
            <div><dt className="text-muted-foreground">Restant</dt><dd className="break-words font-semibold">{euroFormatter.format(goal.remainingAmount)}</dd></div>
          </dl>
          <GoalProgress goal={goal} />
          {goal.targetDate && <p className="text-sm">Date cible : <time dateTime={goal.targetDate}>{goalDateFormatter.format(new Date(goal.targetDate))}</time></p>}
          <GoalWarnings warnings={goal.warnings} />
          {!error && <GoalHistory goal={goal} />}
        </div>}
      </DialogContent>
    </Dialog>
  )
}
