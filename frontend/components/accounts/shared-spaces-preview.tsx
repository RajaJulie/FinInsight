import { Heart, Home, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const sharedSpaceExamples = [
  {
    title: "Couple",
    icon: Heart,
    iconClassName: "bg-rose-500/10 text-rose-300",
    features: ["Compte joint", "Dépenses communes", "Objectif vacances"],
  },
  {
    title: "Famille",
    icon: Users,
    iconClassName: "bg-violet-500/10 text-violet-300",
    features: ["Budget familial", "Courses", "Factures"],
  },
  {
    title: "Colocation",
    icon: Home,
    iconClassName: "bg-cyan-500/10 text-cyan-300",
    features: ["Loyer", "Charges", "Courses"],
  },
] as const

export function SharedSpacesPreview() {
  return (
    <section aria-labelledby="shared-spaces-title">
      <Card className="min-w-0 overflow-hidden border-[#13223a] bg-gradient-to-br from-[#0b1d3a] via-[#071226] to-violet-950/20">
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/15">
                <Users aria-hidden="true" className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle
                    id="shared-spaces-title"
                    className="text-xl text-white"
                  >
                    Espaces partagés
                  </CardTitle>
                  <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-200">
                    <span aria-hidden="true">🚧</span>
                    Bientôt disponible
                  </Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Gérez vos finances avec votre partenaire, votre famille ou
                  vos colocataires tout en conservant vos comptes personnels.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-w-0 space-y-5">
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            {sharedSpaceExamples.map(
              ({ title, icon: Icon, iconClassName, features }) => (
                <div
                  key={title}
                  className="min-w-0 rounded-xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </div>
                    <h3 className="font-semibold text-white">{title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-1.5 shrink-0 rounded-full bg-violet-400"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>

          <div className="flex flex-col gap-2 sm:items-start">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-fit cursor-not-allowed">
                    <Button disabled className="pointer-events-none">
                      <Users aria-hidden="true" className="size-4" />
                      Créer un espace partagé
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Cette fonctionnalité arrivera dans une prochaine version de
                  FinInsight.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground">
              Cette fonctionnalité arrivera dans une prochaine version de
              FinInsight.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
