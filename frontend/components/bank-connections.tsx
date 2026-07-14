"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { CreditCard, Link2, PlusCircle } from "lucide-react"

export function BankConnections() {
  return (
    <Card
      className="
        w-full
        min-w-0
        border-[#13223a]
        bg-gradient-to-t
        from-[#071226]
        to-[#0b1d3a]
      "
    >
      <CardHeader className="min-w-0">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-xl bg-violet-500/10 p-2">
            <CreditCard className="h-5 w-5 text-violet-400" />
          </div>

          <div className="min-w-0">
            <CardTitle className="break-words">Comptes bancaires</CardTitle>

            <p className="mt-1 break-words text-sm text-muted-foreground">
              Aucun compte bancaire connecté.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-5">
        <div className="min-w-0 rounded-xl border border-white/5 bg-black/10 p-4">
          <p className="break-words text-sm text-white">
            Vous pouvez commencer à utiliser <strong>FinInsight</strong> sans
            connecter votre banque.
          </p>

          <p className="mt-2 break-words text-sm text-muted-foreground">
            Ajoutez vos transactions manuellement ou connectez votre banque
            lorsque cette fonctionnalité sera disponible.
          </p>
        </div>

        <Button
          asChild
          className="h-auto min-h-9 w-full min-w-0 whitespace-normal bg-gradient-to-r from-violet-600 to-cyan-500 py-2 text-center"
        >
          <Link href="/transactions">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter une transaction
          </Link>
        </Button>

        <Button
          variant="outline"
          disabled
          className="h-auto min-h-9 w-full min-w-0 flex-wrap whitespace-normal py-2 text-center opacity-70"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Connecter ma banque
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
            Bientôt disponible
          </span>
        </Button>
      </CardContent>
    </Card>
  )
}
