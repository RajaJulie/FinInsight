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
const cache = new Map()
function loadComponent(relativePath) {
  const filename = resolve(frontend, relativePath)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = { exports: {} }
  cache.set(filename, loaded)
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const externalRequire = createRequire(filename)
  new Function("require", "module", "exports", code)(name => name.startsWith("@/")
    ? loadComponent(`${name.slice(2)}.${name.startsWith("@/components/") ? "tsx" : "ts"}`)
    : externalRequire(name), loaded, loaded.exports)
  return loaded.exports
}
const { MonthlyActualSummarySection } = loadComponent("components/budgets/monthly-actual-summary.tsx")
const summary = {
  transactionCount: 4, income: 500, recurringPaidTotal: 34.9, remainingAfterRecurringPayments: 465.1,
  otherExpenses: [{ categoryId: "food", category: "Alimentation", amount: 30 }, { categoryId: "leisure", category: "Loisirs", amount: 10 }],
  otherExpensesTotal: 40, totalExpenses: 74.9, remaining: 425.1,
}
const money = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
const render = (overrides = {}, categoryIcons = {}, options = {}) => renderToStaticMarkup(createElement(MonthlyActualSummarySection, { summary: { ...summary, ...overrides }, categoryIcons, ...options }))

describe("monthly actual summary presentation", () => {
  it("uses sibling Cards with clearly named income, expense and result sections", () => {
    const html = render()
    assert.equal((html.match(/data-slot="card"/g) ?? []).length, 3)
    for (const label of ["Bilan réel du mois", "Revenus réellement encaissés", "Charges récurrentes réellement payées", "Reste après charges", "Dépenses par catégorie", "Total des dépenses variables", "Total des dépenses réelles", "Résultat du mois", "Soldes du mois"]) assert.ok(html.includes(label))
    assert.ok(html.includes('role="region" aria-labelledby="monthly-actual-heading"'))
  })
  it("displays server amounts unchanged, without recalculating the remaining money", () => {
    const html = render({ remaining: 123.45, remainingAfterRecurringPayments: 234.56 })
    for (const value of [500, 34.9, 234.56, 40, 74.9, 123.45]) assert.ok(html.includes(money(value)))
    assert.equal(html.includes(money(425.1)), false)
  })
  it("identifies completed months and shows the exact server-provided final balance breakdown", () => {
    const html = render({ income: 938.07, recurringPaidTotal: 96.45, remainingAfterRecurringPayments: 841.62, otherExpensesTotal: 731.07, totalExpenses: 827.52, remaining: 110.55 }, {}, { completed: true, periodLabel: "Septembre 2026" })
    for (const text of ["Mois terminé", "Septembre 2026", "Résultat du mois", "Reste après charges − dépenses variables réelles", money(841.62), money(731.07), money(110.55)]) assert.ok(html.includes(text))
    assert.ok(html.includes("Revenus et dépenses réels de tous vos comptes"))
    assert.ok(html.includes("soldes calculés sur les comptes sélectionnés"))
    const current = render()
    assert.ok(current.includes("Résultat du mois"))
    assert.equal(current.includes("Mois terminé"), false)
  })
  it("shows accessible bars relative to all other actual category expenses", () => {
    const html = render()
    assert.equal((html.match(/role="meter"/g) ?? []).length, 2)
    assert.ok(html.includes('aria-valuenow="75"'))
    assert.ok(html.includes('aria-valuenow="25"'))
    assert.ok(html.includes('style="width:75%"'))
    assert.ok(html.includes('aria-label="Part de Alimentation dans les dépenses variables"'))
    assert.ok(html.includes('tabindex="0"'))
  })
  it("reuses available category icons and provides a neutral fallback", () => {
    const html = render({}, { food: "utensils" })
    assert.ok(html.includes("lucide-utensils"))
    assert.ok(html.includes("lucide-shapes"))
  })
  it("distinguishes positive, zero and negative results without hiding negative amounts", () => {
    assert.ok(render().includes("Vos revenus couvrent les dépenses enregistrées"))
    const negative = render({ remaining: -20.31 })
    assert.ok(negative.includes(money(-20.31)))
    assert.ok(negative.includes("Les dépenses enregistrées dépassent vos revenus"))
    assert.ok(negative.includes("text-rose-300"))
    const zero = render({ remaining: 0 })
    assert.ok(zero.includes("à l’équilibre"))
    assert.ok(zero.includes("border-white/15 text-white"))
  })
  it("handles empty months and months without variable spending", () => {
    const empty = render({ transactionCount: 0 })
    assert.ok(empty.includes("Aucune transaction de revenu ou de dépense enregistrée"))
    assert.equal(empty.includes('role="meter"'), false)
    assert.equal(empty.includes(money(500)), false)
    const noOther = render({ otherExpenses: [], otherExpensesTotal: 0 })
    assert.ok(noOther.includes("Aucune autre dépense enregistrée."))
    assert.ok(noOther.includes(money(0)))
  })
  it("keeps many long category names in a bounded, keyboard-accessible list", () => {
    const expenses = Array.from({ length: 24 }, (_, index) => ({ categoryId: `c${index}`, category: `Catégorie très longue ${index}`, amount: 1 }))
    const html = render({ otherExpenses: expenses, otherExpensesTotal: 24 })
    assert.equal((html.match(/role="meter"/g) ?? []).length, 24)
    assert.ok(html.includes("max-h-96 overflow-y-auto"))
    assert.ok(html.includes("overflow-wrap:anywhere"))
    assert.ok(html.includes('aria-label="Liste des dépenses par catégorie"'))
    assert.ok(html.includes("Catégorie très longue 23"))
  })
  it("matches the existing budget card background without gray internal surfaces", () => {
    const html = render({ otherExpensesTotal: 0 })
    assert.ok(html.includes("border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]"))
    assert.ok(html.includes("text-white"))
    for (const data of [{}, { remaining: 0 }, { remaining: -1 }, { transactionCount: 0 }, { otherExpenses: [] }]) {
      const state = render(data)
      assert.equal(state.includes("bg-muted"), false)
      assert.equal(state.includes("bg-secondary"), false)
    }
    assert.equal(html.includes("NaN"), false)
    assert.equal(html.includes("Infinity"), false)
    assert.ok(html.includes('style="width:0%"'))
    assert.ok(html.includes(money(30)))
  })
  it("displays server opening and closing balances without recalculating them or confusing them with the result", () => {
    const html = render({ remaining: 459.35 }, {}, {
      cumulativeResult: { accountScope: {
        accounts: [], selectedAccountIds: [], openingBalance: -6.63, closingBalance: 452.72, monthlyResult: 459.35,
        income: 500, expenses: 40.65, transferredToSavings: 0, transfersIn: 0, transfersOut: 0,
        recordedOpeningBalance: 500, firstRecordedMovement: "2026-06-01T00:00:00Z",
      } },
    })
    for (const value of [-6.63, 452.72, 500]) assert.ok(html.includes(money(value)))
    for (const label of ["Solde au début du mois", "Solde à la fin du mois", "Soldes calculés · non vérifiés", "Comprendre le calcul", "non vérifié auprès de la banque"]) assert.ok(html.includes(label))
    assert.ok(html.includes("<details"))
    assert.equal(html.includes("<details open"), false)
    assert.equal(html.includes("Cumul des résultats mensuels"), false)
    assert.ok(html.includes("lg:grid-cols-2"))
    assert.equal(html.includes(money(952.72)), false)
  })
  it("does not invent a cumulative amount when its API data is missing", () => {
    const html = render()
    assert.ok(html.includes("Suivi des comptes indisponible pour ce mois."))
    assert.equal(html.includes("Report du mois précédent"), false)
  })
  it("keeps the historical carry visible in an empty month and preserves a negative cumulative result", () => {
    const html = render({ transactionCount: 0, remaining: 0 }, {}, {
      cumulativeResult: { accountScope: {
        accounts: [], selectedAccountIds: [], openingBalance: -6.63, closingBalance: -6.63, monthlyResult: 0,
        income: 0, expenses: 0, transferredToSavings: 0, transfersIn: 0, transfersOut: 0,
        recordedOpeningBalance: 0, firstRecordedMovement: "2026-06-01T00:00:00Z",
      } },
    })
    assert.ok(html.includes("Aucune transaction de revenu ou de dépense enregistrée"))
    assert.ok(html.includes(money(-6.63)))
    assert.ok(html.includes("text-rose-300"))
    assert.equal(html.includes("Soldes d’ouverture renseignés"), false)
  })
  it("distinguishes available variation, savings transfers and financial results without a fabricated bank balance", () => {
    const scope = {
      accounts: [{ id: "main", name: "Compte réel", type: "CHECKING", currency: "EUR", status: "ACTIVE" }],
      selectedAccountIds: ["main"], previousVariation: 163.27, income: 625.9, expenses: 170.35,
      transfersIn: 0, transfersOut: 0, netTransfers: 0, transferredToSavings: 0, cumulativeTransferredToSavings: 400,
      closingVariation: 618.82, recordedOpeningBalance: 12.34, bankBalance: null, unassignedTransactionCount: 1,
      openingBalance: 175.61, closingBalance: 631.16, monthlyResult: 455.55, firstRecordedMovement: "2026-06-01T00:00:00Z",
    }
    const html = render({ remaining: 455.55 }, {}, { cumulativeResult: {
      previousMonthsResult: 563.27, closingResult: 1018.82, recordedOpeningBalance: 12.34, bankBalance: null, accountScope: scope,
    } })
    for (const value of [175.61, 631.16, 12.34]) assert.ok(html.includes(money(value)))
    for (const label of ["Compte réel", "Solde au début du mois", "Solde à la fin du mois", "Transferts entrants", "Dont vers l’épargne", "non vérifié auprès de la banque", "Solde initial enregistré", "sans compte"]) assert.ok(html.includes(label))
    assert.equal(html.includes(money(1018.82)), false)
    assert.equal(html.includes(money(618.81)), false)
    assert.equal(html.includes("Solde cumulé fin de mois"), false)
    assert.equal(/(?:^|\s)bg-(muted|secondary)(?:\/|\s|")/.test(html), false)
  })
  it("shows undocumented monthly boundaries explicitly, without inventing a zero balance", () => {
    const html = render({}, {}, { cumulativeResult: { accountScope: {
      accounts: [], selectedAccountIds: [], openingBalance: null, closingBalance: null,
      income: 0, expenses: 0, monthlyResult: 0, transferredToSavings: 0, transfersIn: 0, transfersOut: 0,
      recordedOpeningBalance: 100, firstRecordedMovement: null,
    } } })
    assert.equal((html.match(/Non documenté/g) ?? []).length, 2)
    assert.ok(html.includes("Aucune opération disponible"))
    assert.equal(html.includes("NaN"), false)
  })
})
