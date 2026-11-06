/**
 * Suit la transaction visible dans l'historique lors du defilement ou du focus clavier.
 * Expose la ligne active et les commandes de navigation pour le panneau de solde.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getVisibleActiveTransaction } from "@/lib/transactions/active-row"

export function useActiveTransaction(transactionIds: readonly string[], scope: string) {
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const focusedId = useRef<string | null>(null)
  const [selection, setSelection] = useState<{ ids: readonly string[]; scope: string; id: string } | null>(null)
  const activeId = selection?.ids === transactionIds && selection.scope === scope && transactionIds.includes(selection.id)
    ? selection.id : transactionIds[0] ?? null

  const activate = useCallback((id: string) => {
    setSelection(previous => previous?.id === id && previous.ids === transactionIds && previous.scope === scope
      ? previous : { ids: transactionIds, scope, id })
  }, [transactionIds, scope])

  const focusTransaction = useCallback((id: string) => {
    const row = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-transaction-id]") ?? [])
      .find(element => element.dataset.transactionId === id)
    if (!row) return
    focusedId.current = id
    activate(id)
    row.focus({ preventScroll: true })
    const rect = row.getBoundingClientRect()
    const top = (panelRef.current?.getBoundingClientRect().bottom ?? 0) + 12
    if (rect.top < top || rect.bottom > window.innerHeight) {
      window.scrollBy({ top: rect.top - top, behavior: "auto" })
    }
  }, [activate])

  const activateFocusedTransaction = useCallback((id: string) => {
    focusedId.current = id
    activate(id)
  }, [activate])

  useEffect(() => {
    const list = listRef.current
    const panel = panelRef.current
    if (!list || !panel || transactionIds.length === 0) return
    focusedId.current = null
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-transaction-id]"))
    let frame = 0

    const measure = () => {
      frame = 0
      const stickyTop = Number.parseFloat(window.getComputedStyle(panel).top) || 0
      const panelRect = panel.getBoundingClientRect()
      list.style.setProperty("--balance-scroll-offset", `${stickyTop + panelRect.height + 12}px`)
      const top = Math.max(0, panelRect.bottom + 12)
      const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      const id = getVisibleActiveTransaction(rows.map(row => {
        const rect = row.getBoundingClientRect()
        return { id: row.dataset.transactionId!, top: rect.top, bottom: rect.bottom }
      }), top, window.innerHeight, atPageEnd, focusedId.current)
      if (id) activate(id)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure) }
    const clearFocus = () => { focusedId.current = null }
    const onKey = (event: KeyboardEvent) => {
      if (["PageDown", "PageUp", "Home", "End", " "].includes(event.key)) clearFocus()
    }
    // Observers handle visibility/layout changes; passive scrolling covers fast jumps and both directions.
    const intersections = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(schedule, { threshold: [0, 0.5, 1] })
    rows.forEach(row => intersections?.observe(row))
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
    sizes?.observe(panel)
    sizes?.observe(list)
    window.addEventListener("scroll", schedule, { passive: true, capture: true })
    window.addEventListener("resize", schedule)
    window.addEventListener("wheel", clearFocus, { passive: true })
    window.addEventListener("touchmove", clearFocus, { passive: true })
    window.addEventListener("pointerdown", clearFocus, { passive: true })
    window.addEventListener("keydown", onKey, true)
    schedule()
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      intersections?.disconnect()
      sizes?.disconnect()
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("wheel", clearFocus)
      window.removeEventListener("touchmove", clearFocus)
      window.removeEventListener("pointerdown", clearFocus)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [transactionIds, scope, activate])

  return { listRef, panelRef, activeId, focusTransaction, activateFocusedTransaction }
}
