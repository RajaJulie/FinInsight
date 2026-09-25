"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CreditCard, PlusCircle } from "lucide-react"

import { AccountIcon } from "@/components/accounts/account-icon"
import type { AccountsResponse } from "@/components/accounts/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount)
}

export function BankConnections() {
  const [data, setData] = useState<AccountsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()

    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts", {
          signal: controller.signal,
        })
        const responseData = (await response.json()) as AccountsResponse & {
          message?: string
        }

        if (!response.ok) {
          throw new Error(
            responseData.message ?? "Impossible de charger les comptes."
          )
        }

        setData(responseData)
        setError("")
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return
        }

        setError("Impossible de charger les comptes.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAccounts()

    return () => controller.abort()
  }, [])

  const accounts =
    data?.accounts
      .filter((account) => account.status === "ACTIVE")
      .slice(0, 2) ?? []

  return (
    <Card className="w-full min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardHeader className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="shrink-0 rounded-xl bg-violet-500/10 p-2">
              <CreditCard
                aria-hidden="true"
                className="size-5 text-violet-400"
              />
            </div>
            <div className="min-w-0">
              <CardTitle className="break-words">Mes comptes</CardTitle>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Comptes ajoutés manuellement.
              </p>
            </div>
          </div>
          <Link
            href="/accounts"
            className="shrink-0 text-sm text-violet-400 hover:text-violet-300"
          >
            Voir tous
          </Link>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Chargement des comptes...
          </p>
        )}

        {!isLoading && error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        {!isLoading && !error && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucun compte actif pour le moment.
          </p>
        )}

        {!isLoading &&
          !error &&
          accounts.map((account) => (
            <div
              key={account.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-black/10 p-3"
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: `${account.color}20`,
                  color: account.color,
                }}
              >
                <AccountIcon icon={account.icon} className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {account.transactionCount} transaction(s)
                </p>
              </div>
              <p className="shrink-0 font-semibold text-white">
                {formatMoney(account.currentBalance, account.currency)}
              </p>
            </div>
          ))}

        <Button
          asChild
          variant="outline"
          className="h-auto min-h-9 w-full min-w-0 whitespace-normal py-2 text-center"
        >
          <Link href="/accounts">
            <PlusCircle aria-hidden="true" className="mr-2 size-4" />
            Gérer mes comptes
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
