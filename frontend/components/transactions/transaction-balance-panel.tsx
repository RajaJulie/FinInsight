"use client"

import { useEffect, useState, type RefObject } from "react"
import { ChevronDown, ChevronUp, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" })

export function TransactionBalancePanel({ panelRef, transaction, amount, scopeLabel, loading, onPrevious, onNext }: {
  panelRef: RefObject<HTMLDivElement | null>
  transaction: { id: string; title: string; date: string } | null
  amount: number | null
  scopeLabel: string
  loading: boolean
  onPrevious?: () => void
  onNext?: () => void
}) {
  const date = transaction ? dateFormatter.format(new Date(transaction.date)) : ""
  const formattedAmount = amount === null ? "--" : euro.format(amount)
  const [announcement, setAnnouncement] = useState("")
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(loading ? "Chargement des transactions." : transaction
      ? `${scopeLabel}. ${date}, ${transaction.title}. Solde calculé : ${formattedAmount}.`
      : "Aucune transaction affichée."), 300)
    return () => window.clearTimeout(timer)
  }, [date, transaction, formattedAmount, scopeLabel, loading])

  return (
    <Card ref={panelRef} role="region" aria-label="Solde à cette date" className="sticky top-[max(0.75rem,env(safe-area-inset-top))] z-20 min-w-0 gap-2 rounded-lg border border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] px-4 py-3 text-white shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium"><Wallet className="size-4 shrink-0 text-violet-300" aria-hidden="true" />Solde à cette date</h2>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-controls="transaction-history" aria-label="Transaction précédente" title="Transaction précédente" disabled={!onPrevious} onClick={onPrevious}><ChevronUp aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon-xs" aria-controls="transaction-history" aria-label="Transaction suivante" title="Transaction suivante" disabled={!onNext} onClick={onNext}><ChevronDown aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-white/70" title={scopeLabel}>{scopeLabel || "Aucun compte disponible"}</p>
          <p className="min-h-4 truncate text-xs text-white/80" title={transaction?.title}>
            {transaction ? <><time dateTime={transaction.date}>{date}</time> · {transaction.title}</> : loading ? "Chargement..." : "Aucune transaction affichée"}
          </p>
        </div>
        <div className="flex max-w-[48vw] flex-col items-end gap-1 sm:max-w-none">
          <p id="transaction-active-balance" className={`max-w-full break-words text-right text-xl font-semibold tabular-nums sm:text-2xl ${(amount ?? 0) < 0 ? "text-rose-300" : "text-white"}`} aria-live="off">
            <span key={`${scopeLabel}:${transaction?.id ?? "empty"}:${formattedAmount}`} className="inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 motion-reduce:animate-none">{formattedAmount}</span>
          </p>
          <span className="text-[10px] text-white/60">Calculé · non vérifié</span>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </Card>
  )
}
