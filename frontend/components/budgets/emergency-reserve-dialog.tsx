"use client"

import { notifyFinanceChanged } from "@/lib/finance-events"

import { useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { emergencyReserveSchema } from "@/lib/validations/emergency-reserve"

export function EmergencyReserveDialog({
  month,
  year,
  amount,
  onClose,
  onSaved,
}: {
  month: number
  year: number
  amount: number
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(String(amount))
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)
  const period = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving.current) return

    const validation = emergencyReserveSchema.safeParse({
      month,
      year,
      amount: value.trim() === "" ? NaN : Number(value),
    })
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Montant invalide.")
      return
    }

    saving.current = true
    setIsSaving(true)
    setError("")
    try {
      const response = await fetch("/api/budgets/emergency-reserve", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      })
      const data = (await response.json()) as {
        message?: string
        errors?: { fieldErrors?: Record<string, string[]> }
      }
      if (!response.ok) {
        const details = Object.values(data.errors?.fieldErrors ?? {}).flat().join(" ")
        throw new Error(details || data.message || "Impossible d'enregistrer la réserve.")
      }
      onSaved()
      notifyFinanceChanged(false)
      onClose()
    } catch (cause) {
      setError(
        cause instanceof TypeError || cause instanceof SyntaxError
          ? "Impossible de contacter le serveur. Votre montant est conservé."
          : cause instanceof Error
            ? cause.message
            : "Impossible de contacter le serveur."
      )
    } finally {
      saving.current = false
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving.current) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={!isSaving}>
        <DialogHeader>
          <DialogTitle>Réserve d&apos;urgence</DialogTitle>
          <DialogDescription className="capitalize">{period}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-reserve-amount">Montant réservé (€)</Label>
            <Input
              id="emergency-reserve-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={value}
              disabled={isSaving}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "emergency-reserve-error" : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          {error && (
            <p id="emergency-reserve-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
