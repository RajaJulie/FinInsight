import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, PiggyBank, ReceiptText, Wallet, WalletCards, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { CategoryIcon } from "@/components/categories/category-icon"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import type { MonthlyActualSummary } from "@/lib/budgets/actual-summary"
import type { CumulativeMonthlyResult } from "@/lib/budgets/cumulative-result"

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
const percentageFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
const cardStyle = "min-w-0 rounded-lg border border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] py-5 text-white shadow-sm ring-0"

function IncomeExpenseMetric({ title, amount, icon: Icon, income = false }: {
  title: string
  amount: number
  icon: LucideIcon
  income?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${income ? "bg-emerald-500/10 text-emerald-300" : "bg-violet-500/10 text-violet-300"}`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <dl className="min-w-0 space-y-1">
        <dt className="text-sm text-white/70">{title}</dt>
        <dd className="break-words text-2xl font-semibold tabular-nums text-white">{euro.format(amount)}</dd>
      </dl>
    </div>
  )
}

export function MonthlyActualSummarySection({ summary, cumulativeResult = null, accountSelection, categoryIcons = {}, completed = false, periodLabel }: {
  summary: MonthlyActualSummary
  cumulativeResult?: CumulativeMonthlyResult | null
  accountSelection?: ReactNode
  categoryIcons?: Readonly<Record<string, string>>
  completed?: boolean
  periodLabel?: string
}) {
  const resultTone = summary.remaining > 0
    ? "border-emerald-500/25 text-emerald-300"
    : summary.remaining < 0
      ? "border-rose-500/25 text-rose-300"
      : "border-white/15 text-white"
  const resultDescription = summary.remaining > 0
    ? "Vos revenus couvrent les dépenses enregistrées ce mois-ci."
    : summary.remaining < 0
      ? "Les dépenses enregistrées dépassent vos revenus du mois."
      : "Vos revenus et vos dépenses du mois sont à l’équilibre."
  const scope = cumulativeResult?.accountScope

  return (
    <section role="region" aria-labelledby="monthly-actual-heading" className="min-w-0 space-y-4">
    <Card className={`${cardStyle} gap-5`}>
      <CardHeader className="px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <ChartNoAxesCombined className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="monthly-actual-heading" className="text-lg font-semibold text-white">Bilan réel du mois</h2>
              {completed && <Badge variant="outline" className="border-white/15 text-white/70">Mois terminé</Badge>}
            </div>
            {periodLabel && <p className="text-sm font-medium text-white/90">{periodLabel}</p>}
            <CardDescription className="text-white/70">Revenus et dépenses réels de tous vos comptes, puis soldes calculés sur les comptes sélectionnés.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5 px-5">
      {summary.transactionCount === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t border-white/10 py-8 text-center">
          <ReceiptText className="size-8 text-violet-300" aria-hidden="true" />
          <p className="max-w-sm text-sm text-white/70">Aucune transaction de revenu ou de dépense enregistrée pour ce mois.</p>
        </div>
      ) : (
        <>
          <div className="grid min-w-0 gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
            <IncomeExpenseMetric title="Revenus réellement encaissés" amount={summary.income} icon={ArrowDownLeft} income />
            <IncomeExpenseMetric title="Charges récurrentes réellement payées" amount={summary.recurringPaidTotal} icon={ArrowUpRight} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Reste après charges récurrentes</p>
              <p className="mt-1 text-xs text-white/70">Revenus encaissés − charges récurrentes payées</p>
            </div>
            <p className={`break-words text-xl font-semibold tabular-nums ${summary.remainingAfterRecurringPayments < 0 ? "text-rose-300" : "text-white"}`}>{euro.format(summary.remainingAfterRecurringPayments)}</p>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Dépenses par catégorie</h3>
              <span className="text-xs text-white/70">Hors charges récurrentes rapprochées</span>
            </div>
              {summary.otherExpenses.length === 0 ? (
                <p className="rounded-lg border border-white/10 p-4 text-sm text-white/70">Aucune autre dépense enregistrée.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto overscroll-contain rounded-sm pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Liste des dépenses par catégorie">
                  <ul className="space-y-4">
                    {summary.otherExpenses.map(expense => {
                      const percentage = summary.otherExpensesTotal > 0 ? Math.min(100, Math.max(0, expense.amount / summary.otherExpensesTotal * 100)) : 0
                      return (
                        <li key={expense.categoryId ? `id:${expense.categoryId}` : `legacy:${expense.category}`} className="flex min-w-0 items-start gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-violet-300">
                            <CategoryIcon icon={expense.categoryId ? categoryIcons[expense.categoryId] ?? "shapes" : "shapes"} className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <dl className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                              <dt className="min-w-0 [overflow-wrap:anywhere] text-white">{expense.category}</dt>
                              <dd className="max-w-full break-words font-medium tabular-nums text-white">{euro.format(expense.amount)}</dd>
                            </dl>
                            <div role="meter" aria-label={`Part de ${expense.category} dans les dépenses variables`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${percentageFormatter.format(percentage)} %`} className="h-1.5 overflow-hidden rounded-full bg-violet-500/15">
                              <div className="h-full rounded-full bg-violet-300/70" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <dl className="border-t border-white/10 pt-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="font-medium text-white">Total des dépenses variables</dt>
                  <dd className="font-semibold tabular-nums text-white">{euro.format(summary.otherExpensesTotal)}</dd>
                </div>
              </dl>
          </div>

          <dl className="border-t border-white/10 pt-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-white/70">Total des dépenses réelles</dt>
              <dd className="font-medium tabular-nums text-white">{euro.format(summary.totalExpenses)}</dd>
            </div>
          </dl>

        </>
      )}
      </CardContent>
    </Card>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start" aria-live="polite" aria-atomic="true">
      <Card className={cardStyle}>
        <CardContent className="min-w-0 space-y-4 px-5">
          <div className={`border-l-2 pl-4 ${resultTone}`}>
            <div className="flex flex-wrap items-start justify-between gap-4" aria-live="polite" aria-atomic="true">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2"><Wallet className="size-4 shrink-0" aria-hidden="true" /><h3 className="text-sm font-semibold">Résultat du mois</h3></div>
                <p className="text-xs text-white/70">Revenus réels − toutes les dépenses réelles du mois, tous comptes confondus.</p>
                <p className="max-w-md text-xs leading-relaxed">{resultDescription}</p>
              </div>
              <p className="max-w-full break-words text-3xl font-semibold tabular-nums">{euro.format(summary.remaining)}</p>
            </div>
            {completed && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
                <p className="text-xs text-white/70">Reste après charges − dépenses variables réelles</p>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-medium tabular-nums">
                  <span>{euro.format(summary.remainingAfterRecurringPayments)}</span>
                  <span>−</span>
                  <span>{euro.format(summary.otherExpensesTotal)}</span>
                  <span>=</span>
                  <span>{euro.format(summary.remaining)}</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className={cardStyle}>
        <CardContent className="min-w-0 space-y-4 px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-white">
              <WalletCards className="size-4 shrink-0 text-violet-300" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Soldes du mois</h3>
            </div>
            {accountSelection}
          </div>
          {scope ? (
            <>
              <Badge variant="outline" className="h-auto min-h-5 max-w-full whitespace-normal border-white/15 py-1 text-white/70">Soldes calculés · non vérifiés</Badge>
              <p className="break-words text-xs text-white/70">{scope.accounts.filter(account => scope.selectedAccountIds.includes(account.id)).map(account => account.name).join(" · ") || "Aucun compte sélectionné"}</p>
              <dl className="space-y-2 border-t border-white/10 pt-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 pb-3">
                  <dt className="font-semibold text-white">Solde au début du mois</dt>
                  <dd className="font-semibold tabular-nums text-white">{scope.openingBalance == null ? "Non documenté" : euro.format(scope.openingBalance)}</dd>
                </div>
                {([
                  ["Revenus du mois", scope.income],
                  ["Dépenses du mois", scope.expenses],
                  ["Résultat du mois sur ces comptes", scope.monthlyResult],
                ] as const).map(([label, amount]) => (
                  <div key={label} className="flex flex-wrap justify-between gap-2">
                    <dt className="text-white/70">{label}</dt>
                    <dd className="font-medium tabular-nums text-white">{amount == null ? "Non documenté" : euro.format(amount)}</dd>
                  </div>
                ))}
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-white/10 pt-4">
                  <dt className="font-semibold text-white">Solde à la fin du mois</dt>
                  <dd className={`break-words text-2xl font-semibold tabular-nums ${(scope.closingBalance ?? 0) < 0 ? "text-rose-300" : "text-white"}`}>{scope.closingBalance == null ? "Non documenté" : euro.format(scope.closingBalance)}</dd>
                </div>
              </dl>
              <details className="border-t border-white/10 pt-3 text-xs leading-relaxed text-white/70">
                <summary className="w-fit cursor-pointer rounded-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2">Comprendre le calcul</summary>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><dt>Transferts entrants depuis les autres comptes</dt><dd className="tabular-nums">{euro.format(scope.transfersIn)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt>Transferts sortants vers les autres comptes</dt><dd className="tabular-nums">{euro.format(scope.transfersOut)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt className="flex items-center gap-2"><PiggyBank className="size-4 shrink-0" aria-hidden="true" />Dont vers l’épargne ce mois</dt><dd className="tabular-nums">{euro.format(scope.transferredToSavings)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt>Solde initial enregistré</dt><dd className="tabular-nums">{euro.format(scope.recordedOpeningBalance)}</dd></div>
                </dl>
                <p className="mt-3">Solde de début + revenus − dépenses + transferts entrants − transferts sortants. Les transferts entre comptes sélectionnés s’annulent ; les paiements récurrents réels sont comptés une seule fois.</p>
                <p className="mt-2">Calcul basé sur les soldes initiaux enregistrés et l’historique disponible, non vérifié auprès de la banque. La date de référence des soldes initiaux n’est pas enregistrée.</p>
                {scope.openingBalance == null && scope.closingBalance != null && <p className="mt-2">Pour ce premier mois partiel, le solde de fin est estimé depuis la référence initiale avant la première opération disponible ; le début du mois reste non documenté.</p>}
                <p className="mt-2">{scope.firstRecordedMovement ? `Première opération disponible : ${new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(scope.firstRecordedMovement))}.` : "Aucune opération disponible pour dater les soldes de ce mois."} Les périodes antérieures ne sont pas reconstituées.</p>
              </details>
              {scope.unassignedTransactionCount > 0 && <p className="text-xs leading-relaxed text-amber-200">{scope.unassignedTransactionCount} mouvement(s) de revenu ou dépense sans compte : exclus de ce périmètre, conservés dans le résultat financier.</p>}
            </>
          ) : <p className="text-sm text-white/70">Suivi des comptes indisponible pour ce mois.</p>}
        </CardContent>
      </Card>
    </div>
    </section>
  )
}
