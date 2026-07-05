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
        border-[#13223a]
        bg-gradient-to-t
        from-[#071226]
        to-[#0b1d3a]
      "
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2">
            <CreditCard className="h-5 w-5 text-violet-400" />
          </div>

          <div>
            <CardTitle>Comptes bancaires</CardTitle>

            <p className="text-sm text-muted-foreground mt-1">
              Aucun compte bancaire connecté.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-xl border border-white/5 bg-black/10 p-4">
          <p className="text-sm text-white">
            Vous pouvez commencer à utiliser <strong>FinInsight</strong> sans
            connecter votre banque.
          </p>

          <p className="mt-2 text-sm text-muted-foreground">
            Ajoutez vos transactions manuellement ou connectez votre banque
            lorsque cette fonctionnalité sera disponible.
          </p>
        </div>

        <Button
          asChild
          className="w-full bg-gradient-to-r from-violet-600 to-cyan-500"
        >
          <Link href="/transactions">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter une transaction
          </Link>
        </Button>

        <Button
          variant="outline"
          disabled
          className="w-full opacity-70"
        >
          <Link2 className="mr-2 h-4 w-4" />
          Connecter ma banque
          <span className="ml-2 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
            Bientôt disponible
          </span>
        </Button>
      </CardContent>
    </Card>
  )
}