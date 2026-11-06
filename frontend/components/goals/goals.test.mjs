/** Teste le rendu serveur des cartes et etats UI avec les conventions Node existantes. */
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const frontend = fileURLToPath(new URL("../../", import.meta.url))
const cache = new Map()
function loadComponent(path) {
  const filename = resolve(frontend, path)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = { exports: {} }
  cache.set(filename, loaded)
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const external = createRequire(filename)
  new Function("require", "module", "exports", code)(name => {
    if (name === "next/navigation") return { usePathname: () => "/goals" }
    if (name.startsWith(".") || name.startsWith("@/")) {
      const base = name.startsWith("@/") ? resolve(frontend, name.slice(2)) : resolve(filename, "..", name)
      return loadComponent(base + (existsSync(base + ".tsx") ? ".tsx" : ".ts"))
    }
    return external(name)
  }, loaded, loaded.exports)
  return loaded.exports
}
const { GoalCard } = loadComponent("components/goals/goal-card.tsx")
const { GoalHistory } = loadComponent("components/goals/goal-details-dialog.tsx")
const { GoalsListState, GoalsOverview } = loadComponent("components/goals/goals-overview.tsx")
const { GoalsManager } = loadComponent("components/goals/goals-manager.tsx")
const { mainNavigationItems, getNavigationItem } = loadComponent("lib/navigation.ts")
const render = (Component, props) => renderToStaticMarkup(createElement(Component, props))
const account = { id: "a", name: "Compte test", status: "ACTIVE", currency: "EUR", bankBalance: 100, reservedAmount: 20, unreservedAmount: 80, underfunded: false, shortfallAmount: 0, hasFutureEntries: false }
const goal = { id: "g", title: "Voyage", accountId: "a", account, status: "ACTIVE", accumulatedAmount: 20, targetAmount: 100, remainingAmount: 80, progressPercentage: 20, reached: false, targetDate: "2027-06-30T00:00:00Z", warnings: [] }
const noOp = () => {}

describe("goals interface presentation", () => {
  it("renders the server-calculated goal fields and four named actions", () => {
    const html = render(GoalCard, { goal, disabled: false, onAction: noOp })
    for (const text of ["Voyage", "Compte test", "Montant cible", "Montant affecté", "Reste à affecter", "20 %", "30 juin 2027", "Affecter", "Libérer", "Modifier", "Détails"]) assert.ok(html.includes(text), text)
    assert.ok(html.includes('aria-label="Progression de Voyage"'))
  })
  it("caps only the visual bar at 100 and preserves the actual server progress", () => {
    const html = render(GoalCard, { goal: { ...goal, reached: true, accumulatedAmount: 125, remainingAmount: 0, progressPercentage: 125 }, disabled: false, onAction: noOp })
    assert.ok(html.includes("Atteint")); assert.ok(html.includes("125 %"))
    assert.ok(html.includes('aria-valuenow="100"')); assert.ok(html.includes("width:100%"))
  })
  it("blocks allocations but permits releases from paused and archived goals", () => {
    for (const status of ["PAUSED", "ARCHIVED"]) {
      const html = render(GoalCard, { goal: { ...goal, status }, disabled: false, onAction: noOp })
      assert.equal((html.match(/disabled=""/g) ?? []).length, 1)
    }
  })
  it("shows underfunding from the API without clamping a negative free amount", () => {
    const html = render(GoalsOverview, { data: { goals: [goal], accounts: [{ ...account, underfunded: true, unreservedAmount: -10.29, shortfallAmount: 10.29 }] } })
    assert.ok(html.includes("Couverture insuffisante")); assert.ok(html.includes("-10,29"))
    assert.ok(html.includes("non vérifiés")); assert.equal(html.includes("Patrimoine total"), false)
  })
  it("handles loading, empty, filtered, no-account and network-error states", () => {
    const base = { loading: false, error: "", filtered: false, canCreate: true, onCreate: noOp, onRetry: noOp }
    assert.ok(render(GoalsListState, { ...base, loading: true }).includes("Chargement des objectifs"))
    assert.ok(render(GoalsListState, base).includes("Nouvel objectif"))
    assert.ok(render(GoalsListState, { ...base, filtered: true }).includes("Aucun objectif avec ce statut"))
    assert.ok(render(GoalsListState, { ...base, canCreate: false }).includes('href="/accounts"'))
    assert.ok(render(GoalsListState, { ...base, error: "Connexion impossible" }).includes('role="alert"'))
  })
  it("renders chronological virtual allocations and releases, notes and empty history", () => {
    const entries = [{ id: "one", type: "ALLOCATION", amount: 30, effectiveAt: "2026-09-13T00:00:00Z", note: "Projet test" }, { id: "two", type: "RELEASE", amount: 10, effectiveAt: "2026-10-02T00:00:00Z", note: null }]
    const html = render(GoalHistory, { goal: { ...goal, entries } })
    for (const text of ["Affectation", "Libération", "13 septembre 2026", "2 octobre 2026", "Projet test"]) assert.ok(html.includes(text), text)
    assert.ok(html.indexOf("Affectation") < html.indexOf("Libération"))
    assert.ok(render(GoalHistory, { goal: { ...goal, entries: [] } }).includes("Aucune affectation"))
  })
  it("activates the existing Objectifs navigation item without duplication", () => {
    assert.equal(mainNavigationItems.filter(item => item.icon === "goals").length, 1)
    assert.equal(getNavigationItem("/goals").url, "/goals")
    assert.equal(getNavigationItem("/goals/example").url, "/goals")
    assert.ok(render(GoalsManager).includes("Chargement des objectifs"))
  })
  it("protects the real server page before rendering any private interface", async () => {
    const file = resolve(frontend, "app/goals/page.tsx")
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const loaded = { exports: {} }, external = createRequire(file)
    let session = null
    new Function("require", "module", "exports", code)(name => {
      if (name === "@/auth") return { auth: async () => session }
      if (name === "next/navigation") return { redirect: path => { throw new Error(`redirect:${path}`) } }
      if (name.startsWith("@/components/")) return new Proxy({}, { get: () => () => null })
      return external(name)
    }, loaded, loaded.exports)
    await assert.rejects(loaded.exports.default(), /redirect:\/login/)
    session = { user: { name: "Utilisateur test", email: "fixture@example.invalid" } }
    assert.ok(await loaded.exports.default())
  })
})
