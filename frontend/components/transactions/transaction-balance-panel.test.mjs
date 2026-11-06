/**
 * Teste le panneau de solde : donnees recues, montants negatifs, etats vides,
 * commandes clavier et respect des preferences de reduction des animations.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
function loadComponent(path, cache = new Map()) {
  const filename = resolve(frontend, path)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = { exports: {} }
  cache.set(filename, loaded)
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const externalRequire = createRequire(filename)
  new Function("require", "module", "exports", code)(name => name.startsWith("@/")
    ? loadComponent(`${name.slice(2)}.${name.startsWith("@/components/") ? "tsx" : "ts"}`, cache)
    : externalRequire(name), loaded, loaded.exports)
  return loaded.exports
}
const { TransactionBalancePanel } = loadComponent("components/transactions/transaction-balance-panel.tsx")
const money = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
const render = (overrides = {}) => renderToStaticMarkup(createElement(TransactionBalancePanel, {
  panelRef: { current: null }, transaction: { id: "expense", title: "Courses", date: "2026-09-13T00:00:00Z" },
  amount: 123.45, scopeLabel: "LCL + Revolut", loading: false, ...overrides,
}))

describe("active transaction balance presentation", () => {
  it("shows the supplied complete-history balance, date, title and account scope", () => {
    const html = render()
    for (const text of ["Solde à cette date", money(123.45), "13/09/2026", "Courses", "LCL + Revolut", "Calculé · non vérifié"]) assert.ok(html.includes(text))
    assert.ok(html.includes('role="region" aria-label="Solde à cette date"'))
    assert.match(html, /datetime="2026-09-13T00:00:00Z"/i)
    assert.equal(html.includes("Solde après transaction"), false)
  })
  it("preserves negative and zero amounts instead of hiding or clamping them", () => {
    assert.ok(render({ amount: -13.31 }).includes(money(-13.31)))
    assert.ok(render({ amount: -13.31 }).includes("text-rose-300"))
    assert.ok(render({ amount: 0 }).includes(money(0)))
  })
  it("does not invent a balance for loading or empty results", () => {
    for (const loading of [false, true]) {
      const html = render({ transaction: null, amount: null, loading })
      assert.ok(html.includes(loading ? "Chargement..." : "Aucune transaction affichée"))
      assert.ok(html.includes(">--</span>"))
      assert.equal(html.includes(money(0)), false)
      assert.equal(html.includes("<time"), false)
    }
  })
  it("provides named keyboard controls and disables unavailable directions", () => {
    const empty = render()
    assert.equal((empty.match(/disabled=""/g) ?? []).length, 2)
    const html = render({ onNext: () => {}, onPrevious: () => {} })
    assert.equal(html.includes('disabled=""'), false)
    for (const label of ["Transaction précédente", "Transaction suivante"]) assert.ok(html.includes(`aria-label="${label}"`))
    assert.ok(html.includes('aria-controls="transaction-history"'))
    assert.ok(html.includes('role="status" aria-live="polite" aria-atomic="true"'))
  })
  it("uses bounded responsive content and limits animation to motion-safe preferences", () => {
    const html = render({ transaction: { id: "long", title: "A".repeat(300), date: "2026-09-13T00:00:00Z" } })
    for (const token of ["sticky", "minmax(0,1fr)", "truncate", "max-w-[48vw]", "motion-safe:fade-in", "motion-reduce:animate-none"]) assert.ok(html.includes(token))
  })
})
