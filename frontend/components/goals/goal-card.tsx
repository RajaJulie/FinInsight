/** Presente les montants serveur d'un objectif et ses actions virtuelles. */
"use client"

import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, List, Pencil, Target, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { euroFormatter, goalAllocationBlockReason, goalDateFormatter, goalStatusLabels } from "@/lib/goals/forms"
import type { GoalWarning, SavingsGoal } from "@/lib/goals/contracts"

export type GoalAction = "edit" | "allocate" | "release" | "detail"

export function GoalWarnings({ warnings }: { warnings: GoalWarning[] }) {
  if (!warnings.length) return null
  return (
    <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-200" aria-label="Avertissements financiers">
      {warnings.map(warning => <li key={warning.code} className="flex items-start gap-2 break-words">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{warning.message}</span>
      </li>)}
    </ul>
  )
}

export function GoalProgress({ goal }: { goal: SavingsGoal }) {
  const visualPercentage = Math.min(100, Math.max(0, goal.progressPercentage))
  const label = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(goal.progressPercentage)} %`
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Progression</span><span className="font-medium text-foreground">{label}</span></div>
      <div role="progressbar" aria-label={`Progression de ${goal.title}`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={visualPercentage} aria-valuetext={`${label} de la cible`} className="h-2 overflow-hidden rounded-full bg-violet-500/15">
        <div className={`h-full rounded-full ${goal.reached ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${visualPercentage}%` }} />
      </div>
    </div>
  )
}

export function GoalCard({ goal, disabled, onAction }: { goal: SavingsGoal; disabled: boolean; onAction: (action: GoalAction, goal: SavingsGoal) => void }) {
  const allocationReason = goalAllocationBlockReason(goal)
  return (
    <Card className="min-w-0 rounded-lg border border-[#13223a] bg-card dark:bg-gradient-to-t dark:from-[#071226] dark:to-[#0b1d3a]">
      <CardHeader className="min-w-0 gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Target aria-hidden="true" className="size-5 text-violet-400" />
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{goalStatusLabels[goal.status]}</Badge>
            {goal.reached && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><Check aria-hidden="true" className="size-3" />Atteint</Badge>}
          </div>
        </div>
        <div className="min-w-0"><CardTitle className="break-words text-base">{goal.title}</CardTitle><p className="mt-1 break-words text-sm text-muted-foreground">{goal.account.name}</p></div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-5">
        <div><p className="text-xs text-muted-foreground">Montant affecté</p><p className="break-words text-2xl font-semibold tabular-nums">{euroFormatter.format(goal.accumulatedAmount)}</p></div>
        <GoalProgress goal={goal} />
        <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Montant cible</dt><dd className="break-words font-medium tabular-nums">{euroFormatter.format(goal.targetAmount)}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-muted-foreground">Reste à affecter</dt><dd className="break-words font-medium tabular-nums">{euroFormatter.format(goal.remainingAmount)}</dd></div>
        </dl>
        {goal.targetDate && <p className="flex items-start gap-2 text-xs text-muted-foreground"><CalendarDays aria-hidden="true" className="size-4 shrink-0" /><span>Échéance : <time dateTime={goal.targetDate}>{goalDateFormatter.format(new Date(goal.targetDate))}</time></span></p>}
        <GoalWarnings warnings={goal.warnings} />
        {allocationReason && <p className="text-xs text-muted-foreground">{allocationReason}</p>}
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button size="sm" disabled={disabled || !!allocationReason} onClick={() => onAction("allocate", goal)} aria-label={`Affecter à ${goal.title}`}><ArrowDownToLine aria-hidden="true" className="size-4" />Affecter</Button>
          <Button size="sm" variant="outline" disabled={disabled || goal.accumulatedAmount <= 0 || goal.account.hasFutureEntries} onClick={() => onAction("release", goal)} aria-label={`Libérer de ${goal.title}`}><ArrowUpFromLine aria-hidden="true" className="size-4" />Libérer</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction("edit", goal)} aria-label={`Modifier ${goal.title}`}><Pencil aria-hidden="true" className="size-4" />Modifier</Button>
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAction("detail", goal)} aria-label={`Détails de ${goal.title}`}><List aria-hidden="true" className="size-4" />Détails</Button>
        </div>
      </CardContent>
    </Card>
  )
}
