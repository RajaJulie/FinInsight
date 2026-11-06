/**
 * Permet de confirmer un rapprochement incertain entre une charge et un paiement.
 * Enregistre l'association via l'API puis demande le rafraichissement des donnees financieres.
 */
"use client"

import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatFrenchDate } from "@/lib/recurring/date-period"
import type { PendingRecurringPayment } from "@/lib/recurring/reconciliation"
import { notifyFinanceChanged } from "@/lib/finance-events"

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

export function RecurringPaymentDialog({ payment, onClose, onChanged }: {
  payment: PendingRecurringPayment
  onClose: () => void
  onChanged: () => void
}) {
  const [chargeId, setChargeId] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return
    if (!payment.candidates.some((charge) => charge.id === chargeId)) {
      setError("Choisissez la charge correspondant réellement à ce paiement.")
      return
    }
    saving.current = true
    setIsSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/recurring-transactions/${encodeURIComponent(chargeId)}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: payment.transactionId }),
      })
      const data = await response.json() as { message?: string }
      if (response.status !== 201) {
        if (response.status === 404 || response.status === 409) onChanged()
        throw new Error(data.message ?? "Impossible de rapprocher ce paiement.")
      }
      onClose()
      onChanged()
      notifyFinanceChanged()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erreur réseau. Veuillez réessayer.")
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving.current) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rapprocher un paiement récurrent</DialogTitle>
          <DialogDescription>Confirmez uniquement si cette transaction est bien le paiement de la charge sélectionnée. La transaction bancaire restera inchangée.</DialogDescription>
        </DialogHeader>
        <p className="break-words text-sm">{payment.title} · {money.format(payment.amount)} · {formatFrenchDate(payment.date)}</p>
        <form onSubmit={confirm} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-recurring-charge">Charge récurrente</Label>
            <Select value={chargeId} onValueChange={setChargeId} disabled={isSaving}>
              <SelectTrigger id="payment-recurring-charge" className="w-full"><SelectValue placeholder="Choisir la charge" /></SelectTrigger>
              <SelectContent>{payment.candidates.map((charge) => <SelectItem key={charge.id} value={charge.id}>{charge.title} · {money.format(charge.amount)} · le {charge.dayOfMonth}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSaving || !chargeId}>{isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Confirmer le rapprochement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
