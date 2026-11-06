/** Confirme une operation virtuelle et conserve sa cle si son resultat est incertain. */
"use client"

import { useRef, useState, type FormEvent } from "react"
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GoalEntryPayload, GoalEntryResponse, GoalEntryType, SavingsGoal } from "@/lib/goals/contracts"
import { buildGoalEntryInput, euroFormatter, goalAllocationBlockReason } from "@/lib/goals/forms"
import { createGoalEntryIntent } from "@/lib/goals/entry-intent"
import { GoalRequestError, goalErrorMessage, requestGoals } from "@/lib/goals/client"

export function GoalEntryDialog({ goal, type, onClose, onSaved, onRefresh }: {
  goal: SavingsGoal; type: GoalEntryType; onClose: () => void; onSaved: () => void; onRefresh: () => void;
}) {
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const intent = useRef(createGoalEntryIntent())
  const lastInput = useRef<Omit<GoalEntryPayload, "idempotencyKey"> | null>(null)
  const busy = useRef(false)
  const allocation = type === "ALLOCATION"
  const blockReason = allocation ? goalAllocationBlockReason(goal) : goal.account.hasFutureEntries ? "Des écritures futures sur ce compte doivent être vérifiées." : null

  function close() {
    if (busy.current) return
    if (uncertain && !window.confirm("Le résultat de l'opération est incertain. Elle peut déjà être enregistrée. Fermer et actualiser les objectifs ?")) return
    if (uncertain) onRefresh()
    onClose()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setError("")
    try {
      // Une nouvelle lecture des fonds ne doit pas bloquer la verification d'une requete peut-etre deja executee.
      const input = intent.current.uncertain && lastInput.current ? lastInput.current : buildGoalEntryInput(type, amount, note, goal)
      lastInput.current = input
      busy.current = true
      setSubmitting(true)
      const result = await intent.current.run(goal.id, input, payload => requestGoals<GoalEntryResponse>(`/api/goals/${encodeURIComponent(goal.id)}/entries`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      }))
      if (result) { toast.success(result.message); onSaved() }
    } catch (failure) {
      setError(goalErrorMessage(failure))
      setUncertain(intent.current.uncertain)
      if (failure instanceof GoalRequestError && [404, 409].includes(failure.status)) {
        toast.error(goalErrorMessage(failure))
        onRefresh()
      }
    } finally { busy.current = false; setSubmitting(false) }
  }
  return (
    <Dialog open onOpenChange={open => { if (!open) close() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!submitting}>
        <DialogHeader><DialogTitle>{allocation ? "Affecter de l'argent" : "Libérer de l'argent"}</DialogTitle>
          <DialogDescription>{allocation ? "L'argent reste sur le compte bancaire. Il est réservé virtuellement à cet objectif." : "L'argent redevient non réservé sur le même compte. Aucun revenu bancaire n'est créé."}</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3 border-b pb-4"><p className="break-words font-medium">{goal.title}</p><p className="break-words text-sm text-muted-foreground">{goal.account.name}</p>
          <dl className="space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt>Déjà affecté</dt><dd className="font-medium tabular-nums">{euroFormatter.format(goal.accumulatedAmount)}</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt>{allocation ? "Disponible à affecter" : "Montant maximal libérable"}</dt><dd className="font-semibold tabular-nums">{euroFormatter.format(allocation ? goal.account.unreservedAmount : goal.accumulatedAmount)}</dd></div>
          </dl>
        </div>
        <form onSubmit={submit} className="space-y-4" aria-busy={submitting}>
          <fieldset disabled={submitting || uncertain} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="goal-entry-amount">Montant (€)</Label><Input id="goal-entry-amount" inputMode="decimal" required maxLength={14} placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="goal-entry-note">Note (facultative)</Label><Input id="goal-entry-note" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></div>
          </fieldset>
          {blockReason && !uncertain && <p className="text-sm text-amber-700 dark:text-amber-200">{blockReason}</p>}
          {error && <p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p>}
          {uncertain && <p role="status" className="text-sm text-amber-700 dark:text-amber-200">Le résultat n’est pas confirmé. Réessayez la même opération pour le vérifier sans créer de doublon.</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={close}>{uncertain ? "Fermer et vérifier" : "Annuler"}</Button>
            <Button type="submit" disabled={submitting || (!uncertain && !!blockReason)}>
              {submitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : allocation ? <ArrowDownToLine aria-hidden="true" className="size-4" /> : <ArrowUpFromLine aria-hidden="true" className="size-4" />}
              {submitting ? "Enregistrement..." : uncertain ? "Réessayer la même opération" : allocation ? "Confirmer l'affectation" : "Confirmer la libération"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
