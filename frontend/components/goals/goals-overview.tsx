/** Synthese et etats de la page ; les montants par compte viennent exclusivement de l'API. */
import Link from "next/link"
import { Check, Plus, RefreshCw, Target, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { GoalsResponse } from "@/lib/goals/contracts"
import { euroFormatter } from "@/lib/goals/forms"

export function GoalsOverview({ data }: { data: GoalsResponse }) {
  const metrics = [
    { label: "Objectifs actifs", count: data.goals.filter(goal => goal.status === "ACTIVE").length, Icon: Target },
    { label: "Objectifs atteints", count: data.goals.filter(goal => goal.reached).length, Icon: Check },
    { label: "Comptes à surveiller", count: data.accounts.filter(account => account.underfunded).length, Icon: TriangleAlert },
  ]
  const accounts = data.accounts.filter(account => account.currency === "EUR" && (account.status === "ACTIVE" || account.reservedAmount > 0))
  return (
    <>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        {metrics.map(({ label, count, Icon }) => <Card key={label} className="min-w-0 rounded-lg border border-[#13223a] bg-card dark:bg-gradient-to-t dark:from-[#071226] dark:to-[#0b1d3a]" size="sm">
          <CardContent className="flex items-center gap-3"><Icon aria-hidden="true" className="size-5 shrink-0 text-violet-400" /><div className="min-w-0"><p className="break-words text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums">{count}</p></div></CardContent>
        </Card>)}
      </div>
      {!!accounts.length && <section aria-labelledby="goals-funds-title" className="min-w-0 border-y py-5">
        <div className="mb-3"><h2 id="goals-funds-title" className="font-semibold">Fonds par compte</h2><p className="mt-1 text-xs text-muted-foreground">Comptes en euros · soldes calculés à partir des données enregistrées, non vérifiés auprès des banques.</p></div>
        <ul className="divide-y">
          {accounts.map(account => <li key={account.id} className="min-w-0 py-4 first:pt-1 last:pb-0">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_2fr] sm:gap-6"><div className="min-w-0"><p className="break-words text-sm font-medium">{account.name}</p>{account.status === "ARCHIVED" && <p className="text-xs text-muted-foreground">Compte archivé</p>}</div>
              <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm min-[400px]:grid-cols-3">
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Solde calculé</dt><dd className="break-words tabular-nums">{euroFormatter.format(account.bankBalance)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Déjà réservé</dt><dd className="break-words tabular-nums">{euroFormatter.format(account.reservedAmount)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Non réservé</dt><dd className={`break-words font-semibold tabular-nums ${account.underfunded ? "text-red-600 dark:text-red-300" : ""}`}>{euroFormatter.format(account.unreservedAmount)}</dd></div>
              </dl>
            </div>
            {account.underfunded && <p className="mt-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-200"><TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Couverture insuffisante : {euroFormatter.format(account.shortfallAmount)} manquants pour couvrir les sommes réservées.</span></p>}
          </li>)}
        </ul>
      </section>}
    </>
  )
}

export function GoalsListState({ loading, error, filtered, canCreate, onCreate, onRetry }: {
  loading: boolean; error: string; filtered: boolean; canCreate: boolean; onCreate: () => void; onRetry: () => void;
}) {
  if (loading) return <div role="status" aria-label="Chargement des objectifs" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(id => <Skeleton key={id} className="h-72 rounded-lg" />)}</div>
  if (error) return <div className="space-y-3 border-y py-8"><p role="alert" className="break-words text-sm text-red-600 dark:text-red-300">{error}</p><Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" className="size-4" />Réessayer</Button></div>
  return <div className="flex flex-col items-center gap-3 border-y px-4 py-10 text-center"><Target aria-hidden="true" className="size-8 text-violet-400" /><h3 className="font-semibold">{filtered ? "Aucun objectif avec ce statut" : "Votre prochain projet commence ici"}</h3>
    <p className="max-w-md text-sm text-muted-foreground">{filtered ? "Choisissez un autre statut pour retrouver vos objectifs." : "Réservez une partie de l'argent de vos comptes pour les projets qui comptent pour vous."}</p>
    {!filtered && (canCreate ? <Button onClick={onCreate}><Plus aria-hidden="true" className="size-4" />Nouvel objectif</Button> : <Button variant="outline" asChild><Link href="/accounts">Ajouter un compte en euros</Link></Button>)}
  </div>
}
