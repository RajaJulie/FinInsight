/** Formulaire partage de creation et modification ; le compte reste fixe a l'edition. */
"use client"

import { useRef, useState, type FormEvent } from "react"
import { LoaderCircle, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { GoalAccount, GoalMutationResponse, GoalStatus, SavingsGoal } from "@/lib/goals/contracts"
import { buildGoalFormPayload, goalFormDefaults, goalStatusLabels, goalStatusOptions, isEligibleGoalAccount } from "@/lib/goals/forms"
import { goalErrorMessage, requestGoals } from "@/lib/goals/client"

export function GoalDialog({ goal, accounts, onClose, onSaved }: { goal?: SavingsGoal; accounts: GoalAccount[]; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState(() => goalFormDefaults(goal))
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [archiveConfirmed, setArchiveConfirmed] = useState(false)
  const busy = useRef(false)
  const needsArchiveConfirmation = values.status === "ARCHIVED" && goal?.status !== "ARCHIVED"
  const eligibleAccounts = accounts.filter(isEligibleGoalAccount)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setError("")
    try {
      const payload = buildGoalFormPayload(values, goal)
      if (needsArchiveConfirmation && !archiveConfirmed) throw new Error("Confirmez l'archivage avant d'enregistrer.")
      if (!goal && !eligibleAccounts.some(account => account.id === values.accountId)) throw new Error("Choisissez un compte actif en euros.")
      busy.current = true
      setSubmitting(true)
      const result = await requestGoals<GoalMutationResponse>(goal ? `/api/goals/${encodeURIComponent(goal.id)}` : "/api/goals", {
        method: goal ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      toast.success(result.message)
      onSaved()
    } catch (failure) { setError(goalErrorMessage(failure)) }
    finally { busy.current = false; setSubmitting(false) }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy.current) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!submitting}>
        <DialogHeader><DialogTitle>{goal ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
          <DialogDescription>{goal ? "Les sommes affectées et leur historique sont conservés." : "Une enveloppe virtuelle sur un compte existant, sans affectation automatique."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={submitting}>
          <fieldset disabled={submitting} className="min-w-0 space-y-4">
            <div className="space-y-2"><Label htmlFor="goal-title">Titre</Label><Input id="goal-title" required maxLength={120} autoComplete="off" value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="goal-account">Compte associé</Label>
              {goal ? <><Input id="goal-account" value={goal.account.name} readOnly /><p className="text-xs text-muted-foreground">Le compte associé ne change pas depuis ce formulaire.</p></> :
                <Select value={values.accountId} onValueChange={accountId => setValues({ ...values, accountId })}>
                  <SelectTrigger id="goal-account" className="w-full"><SelectValue placeholder="Choisir un compte" /></SelectTrigger>
                  <SelectContent>{eligibleAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
                </Select>}
              {!goal && !eligibleAccounts.length && <p className="text-sm text-amber-700 dark:text-amber-200">Créez d’abord un compte actif en euros dans Comptes.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="goal-target">Montant cible (€)</Label><Input id="goal-target" required inputMode="decimal" maxLength={14} placeholder="0,00" value={values.targetAmount} onChange={e => setValues({ ...values, targetAmount: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="goal-date">Date cible (facultative)</Label><Input id="goal-date" type="date" value={values.targetDate} onChange={e => setValues({ ...values, targetDate: e.target.value })} /></div>
            </div>
            {goal && <div className="space-y-2"><Label htmlFor="goal-status">Statut</Label>
              <Select value={values.status} onValueChange={status => setValues({ ...values, status: status as GoalStatus })}>
                <SelectTrigger id="goal-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{goalStatusOptions(goal.status).map(status => <SelectItem key={status} value={status}>{goalStatusLabels[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            {needsArchiveConfirmation && <div className="flex items-start gap-2"><Checkbox id="goal-archive-confirm" checked={archiveConfirmed} onCheckedChange={checked => setArchiveConfirmed(checked === true)} /><Label htmlFor="goal-archive-confirm" className="text-sm leading-relaxed">Je confirme l’archivage. L’argent reste réservé jusqu’à sa libération.</Label></div>}
          </fieldset>
          {error && <p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={submitting || (!goal && !eligibleAccounts.length)}>{submitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden="true" className="size-4" />}{submitting ? "Enregistrement..." : goal ? "Enregistrer" : "Créer l'objectif"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
