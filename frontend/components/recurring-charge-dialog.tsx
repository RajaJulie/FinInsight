/**
 * Formulaire partage d'ajout manuel et de modification d'une charge recurrente.
 * Charge les comptes et categories, valide les periodes et appelle l'API sans creer de paiement.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { recurringTransactionSchema, updateRecurringTransactionSchema } from "@/lib/validations/recurring-transaction"
import { notifyFinanceChanged } from "@/lib/finance-events"
import { formatFrenchDate } from "@/lib/recurring/date-period"
import { getRecurringChargeEditPayload, getRecurringChargeFormValues, needsRecurringPeriodCorrection, type RecurringChargeData, type RecurringChargeFormValues } from "@/lib/recurring/charge-form"

type Category = { id: string; name: string; type: string }
type Account = { id: string; name: string; status: string }
type ErrorBody = { message?: string; errors?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] } }

export function RecurringChargeDialog({ open, onOpenChange, month, year, onCreated, recurringCharge, onUpdated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: number
  year: number
  onCreated?: () => void
  recurringCharge?: RecurringChargeData
  onUpdated?: (charge: RecurringChargeData) => void
}) {
  const [values, setValues] = useState<RecurringChargeFormValues>(() => getRecurringChargeFormValues(recurringCharge, month, year))
  const [confirmPeriodCorrection, setConfirmPeriodCorrection] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [optionsError, setOptionsError] = useState("")
  const [error, setError] = useState("")
  const [optionsVersion, setOptionsVersion] = useState(0)
  const savingRef = useRef(false)
  const editing = Boolean(recurringCharge)
  const categoryType = recurringCharge?.type ?? "EXPENSE"
  const needsCorrection = recurringCharge ? needsRecurringPeriodCorrection(values, recurringCharge) : false

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    async function loadOptions() {
      try {
        const [categoryResponse, accountResponse] = await Promise.all([
          fetch("/api/categories", { signal: controller.signal }),
          fetch("/api/accounts", { signal: controller.signal }),
        ])
        const categoryData = await categoryResponse.json() as { categories: Category[]; message?: string }
        const accountData = await accountResponse.json() as { accounts: Account[]; message?: string }
        if (!categoryResponse.ok) throw new Error(categoryData.message ?? "Impossible de charger les catégories.")
        if (!accountResponse.ok) throw new Error(accountData.message ?? "Impossible de charger les comptes.")
        if (controller.signal.aborted) return
        setCategories(categoryData.categories.filter((item) => item.type === categoryType))
        setAccounts(accountData.accounts.filter((item) => item.status === "ACTIVE" || item.id === recurringCharge?.account.id))
      } catch (error) {
        if (!controller.signal.aborted) setOptionsError(error instanceof Error ? error.message : "Impossible de charger le formulaire.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }
    void loadOptions()
    return () => controller.abort()
  }, [open, optionsVersion, categoryType, recurringCharge?.account.id])

  function update(key: keyof RecurringChargeFormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === "startDate" || key === "endDate") setConfirmPeriodCorrection(false)
    setError("")
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current || isLoading || optionsError) return
    const creationPayload = { ...values, title: values.title.trim(), amount: Number(values.amount.replace(",", ".")), dayOfMonth: Number(values.dayOfMonth), type: categoryType, frequency: "MONTHLY", active: recurringCharge?.active ?? true, endDate: values.endDate || null }
    const validation = recurringTransactionSchema.safeParse(creationPayload)
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Données invalides.")
      return
    }
    if (!categories.some((item) => item.id === values.categoryId) || !accounts.some((item) => item.id === values.accountId)) {
      setError("Sélectionnez une catégorie compatible et un compte disponible.")
      return
    }
    if (needsCorrection && !confirmPeriodCorrection) {
      setError("Confirmez la correction historique avant d’enregistrer les dates.")
      return
    }
    const payload = recurringCharge ? {
      ...getRecurringChargeEditPayload(values, recurringCharge),
      ...(needsCorrection ? { confirmPeriodCorrection: true } : {}),
    } : creationPayload
    if (recurringCharge && Object.keys(payload).length === 0) {
      onOpenChange(false)
      return
    }
    if (recurringCharge && !updateRecurringTransactionSchema.safeParse(payload).success) {
      setError("Les modifications sont invalides.")
      return
    }
    savingRef.current = true
    setIsSaving(true)
    setError("")
    try {
      const response = await fetch(recurringCharge ? `/api/recurring-transactions/${recurringCharge.id}` : "/api/recurring-transactions", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json() as ErrorBody & { recurringTransaction?: RecurringChargeData }
      if (response.status !== (editing ? 200 : 201) || (editing && !data.recurringTransaction)) {
        const messages = [...(data.errors?.formErrors ?? []), ...Object.values(data.errors?.fieldErrors ?? {}).flatMap((items) => items ?? [])]
        throw new Error(messages[0] ?? data.message ?? "Impossible d’enregistrer cette charge récurrente.")
      }
      onOpenChange(false)
      if (editing && data.recurringTransaction) onUpdated?.(data.recurringTransaction)
      else onCreated?.()
      notifyFinanceChanged(false)
    } catch (error) {
      setError(error instanceof TypeError
        ? "Erreur réseau. Vos valeurs sont conservées. Veuillez réessayer."
        : error instanceof Error ? error.message : "Impossible d’enregistrer cette charge récurrente.")
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!savingRef.current) onOpenChange(nextOpen) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la charge récurrente" : "Ajouter une charge récurrente"}</DialogTitle>
          <DialogDescription>{editing ? "Abonnement et période d’application." : "Charge mensuelle prévue, sans création de paiement bancaire."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {recurringCharge && <p className="text-sm text-muted-foreground">Dernier paiement réel associé : {formatFrenchDate(recurringCharge.lastPaymentDate ?? null)}</p>}
          {isLoading && <p role="status" className="text-sm text-muted-foreground">Chargement des catégories et des comptes…</p>}
          {optionsError && <div role="alert" className="space-y-2 text-sm text-red-400"><p>{optionsError}</p><Button type="button" variant="outline" size="sm" onClick={() => { setIsLoading(true); setOptionsError(""); setOptionsVersion((value) => value + 1) }}>Réessayer</Button></div>}
          <fieldset disabled={isLoading || isSaving || Boolean(optionsError)} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="manual-recurring-title">Nom de la charge</Label><Input id="manual-recurring-title" value={values.title} onChange={(event) => update("title", event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-amount">Montant en euros</Label><Input id="manual-recurring-amount" inputMode="decimal" placeholder="34,90" value={values.amount} onChange={(event) => update("amount", event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-frequency">Fréquence</Label><Input id="manual-recurring-frequency" value="Mensuelle" readOnly /></div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-category">{categoryType === "INCOME" ? "Catégorie de revenu" : "Catégorie de dépense"}</Label><Select value={values.categoryId} onValueChange={(value) => update("categoryId", value)} disabled={isLoading || isSaving || Boolean(optionsError)}><SelectTrigger id="manual-recurring-category" className="w-full"><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{!isLoading && !optionsError && categories.length === 0 && <p className="text-sm text-muted-foreground">Aucune catégorie compatible disponible.</p>}</div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-account">Compte bancaire associé</Label><Select value={values.accountId} onValueChange={(value) => update("accountId", value)} disabled={isLoading || isSaving || Boolean(optionsError)}><SelectTrigger id="manual-recurring-account" className="w-full"><SelectValue placeholder="Choisir un compte" /></SelectTrigger><SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id} disabled={item.status !== "ACTIVE"}>{item.name}{item.status !== "ACTIVE" ? " (archivé)" : ""}</SelectItem>)}</SelectContent></Select>{!isLoading && !optionsError && accounts.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte actif disponible.</p>}</div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-day">Jour du prélèvement</Label><Input id="manual-recurring-day" type="number" min={1} max={31} step={1} value={values.dayOfMonth} onChange={(event) => update("dayOfMonth", event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="manual-recurring-start">Date de début</Label><Input id="manual-recurring-start" type="date" value={values.startDate} onChange={(event) => update("startDate", event.target.value)} required /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="manual-recurring-end">Date de fin effective de l’abonnement{recurringCharge && !recurringCharge.active ? "" : " (facultative)"}</Label><Input id="manual-recurring-end" type="date" min={values.startDate || undefined} value={values.endDate} onChange={(event) => update("endDate", event.target.value)} required={Boolean(recurringCharge && !recurringCharge.active)} /></div>
          </fieldset>
          {editing && Number(values.amount.replace(",", ".")) !== recurringCharge?.amount && <p className="text-sm text-muted-foreground">{recurringCharge?.active ? "Nouveau montant à partir du mois courant. Les montants antérieurs sont conservés." : "Montant prévu pour une prochaine réactivation. Les périodes clôturées sont conservées."}</p>}
          {needsCorrection && <div className="flex items-start gap-3 text-sm"><Checkbox id="recurring-period-correction" checked={confirmPeriodCorrection} onCheckedChange={(checked) => setConfirmPeriodCorrection(checked === true)} disabled={isSaving} /><Label htmlFor="recurring-period-correction" className="block leading-relaxed">Je confirme la correction historique des dates et le recalcul des mois concernés.</Label></div>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isLoading || isSaving || Boolean(optionsError) || categories.length === 0 || accounts.length === 0}>{isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{isSaving ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Confirmer l’ajout"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
