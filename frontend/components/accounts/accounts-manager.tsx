"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Archive,
  CalendarClock,
  CreditCard,
  Link2,
  Pencil,
  PiggyBank,
  Plus,
  Star,
  Trash2,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import { AccountDialog } from "@/components/accounts/account-dialog"
import { AccountIcon } from "@/components/accounts/account-icon"
import { SharedSpacesPreview } from "@/components/accounts/shared-spaces-preview"
import type {
  AccountItem,
  AccountsResponse,
  AccountType,
} from "@/components/accounts/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatMoney(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount)
}

function getAccountTypeLabel(type: AccountType) {
  const labels: Record<AccountType, string> = {
    CHECKING: "Courant",
    SAVINGS: "Épargne",
    CASH: "Espèces",
    INVESTMENT: "Investissement",
    CREDIT: "Crédit",
    OTHER: "Autre",
  }

  return labels[type]
}

async function requestAccounts() {
  const response = await fetch("/api/accounts")
  const data = (await response.json()) as AccountsResponse & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message ?? "Impossible de charger les comptes.")
  }

  return data
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof WalletCards
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
      <CardContent className="flex min-w-0 items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-xl font-semibold text-white">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountCard({
  account,
  onEdit,
  onArchive,
  onDelete,
}: {
  account: AccountItem
  onEdit: (account: AccountItem) => void
  onArchive: (account: AccountItem) => void
  onDelete: (account: AccountItem) => void
}) {
  const isArchived = account.status === "ARCHIVED"

  return (
    <Card
      className={`min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] transition hover:border-violet-500/40 ${
        isArchived ? "opacity-70" : ""
      }`}
    >
      <CardHeader className="min-w-0 pb-0">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${account.color}20`,
              color: account.color,
            }}
          >
            <AccountIcon icon={account.icon} className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle className="truncate text-base">{account.name}</CardTitle>
              {account.isPrimary && (
                <Badge className="bg-amber-500/10 text-amber-300">
                  Principal
                </Badge>
              )}
            </div>
            <Badge
              variant="outline"
              className="mt-2 w-fit gap-1.5 border-violet-400/25 bg-violet-500/10 text-violet-200"
            >
              {account.type === "SAVINGS" && (
                <PiggyBank aria-hidden="true" className="size-3.5" />
              )}
              {getAccountTypeLabel(account.type)}
            </Badge>
          </div>
          <Badge variant="outline">
            {isArchived ? "Archivé" : "Actif"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Solde actuel</p>
          <p className="break-words text-2xl font-semibold text-white">
            {formatMoney(account.currentBalance, account.currency)}
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-xl bg-white/5 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="font-semibold text-white">
              {account.transactionCount}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs text-muted-foreground">Dernière activité</p>
            <p className="truncate text-sm font-semibold text-white">
              {account.lastActivity
                ? dateFormatter.format(new Date(account.lastActivity))
                : "Aucune"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`Modifier ${account.name}`}
            onClick={() => onEdit(account)}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={
              isArchived
                ? `Réactiver ${account.name}`
                : `Archiver ${account.name}`
            }
            onClick={() => onArchive(account)}
          >
            <Archive aria-hidden="true" className="size-4" />
            {isArchived ? "Réactiver" : "Archiver"}
          </Button>
          {account.transactionCount === 0 && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Supprimer ${account.name}`}
              onClick={() => onDelete(account)}
            >
              <Trash2 aria-hidden="true" className="size-4 text-red-400" />
              Supprimer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AccountsManager() {
  const [data, setData] = useState<AccountsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accountToEdit, setAccountToEdit] = useState<AccountItem | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<AccountItem | null>(
    null
  )
  const [isActing, setIsActing] = useState(false)
  const [actionError, setActionError] = useState("")

  const loadAccounts = useCallback(async () => {
    try {
      const nextData = await requestAccounts()
      setData(nextData)
      setLoadError("")
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les comptes."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    requestAccounts()
      .then((nextData) => {
        if (isMounted) {
          setData(nextData)
          setLoadError("")
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les comptes."
          )
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function updateStatus(account: AccountItem) {
    try {
      setIsActing(true)
      setActionError("")
      const nextStatus =
        account.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const responseData = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(
          responseData.message ?? "Impossible de modifier le statut du compte."
        )
      }

      toast.success(
        nextStatus === "ARCHIVED"
          ? "Compte archivé avec succès."
          : "Compte réactivé avec succès."
      )
      await loadAccounts()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de modifier le statut du compte."
      )
    } finally {
      setIsActing(false)
    }
  }

  async function deleteAccount() {
    if (!accountToDelete) return

    try {
      setIsActing(true)
      setActionError("")
      const response = await fetch(`/api/accounts/${accountToDelete.id}`, {
        method: "DELETE",
      })
      const responseData = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(
          responseData.message ?? "Impossible de supprimer le compte."
        )
      }

      toast.success("Compte supprimé avec succès.")
      setAccountToDelete(null)
      await loadAccounts()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer le compte."
      )
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  const accounts = data?.accounts ?? []
  const activeAccounts = accounts.filter(
    (account) => account.status === "ACTIVE"
  )
  const archivedAccounts = accounts.filter(
    (account) => account.status === "ARCHIVED"
  )

  return (
    <>
      <AccountDialog
        account={accountToEdit}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setAccountToEdit(null)
        }}
        onSaved={() => void loadAccounts()}
      />

      <AlertDialog
        open={accountToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isActing) {
            setAccountToDelete(null)
            setActionError("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Elle est autorisée uniquement pour
              un compte sans transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError && (
            <p role="alert" className="text-sm text-red-400">
              {actionError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActing}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void deleteAccount()
              }}
            >
              {isActing ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Comptes</h1>
            <p className="text-muted-foreground">
              Suivez vos soldes et organisez vos comptes
            </p>
          </div>
          <Button
            className="bg-gradient-to-r from-violet-600 to-cyan-500"
            onClick={() => {
              setAccountToEdit(null)
              setDialogOpen(true)
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Ajouter un compte
          </Button>
        </div>

        {loadError ? (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p role="alert" className="text-red-300">
                {loadError}
              </p>
              <Button variant="outline" onClick={() => void loadAccounts()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Solde total"
                value={formatMoney(data?.summary.totalBalance ?? 0)}
                description="Comptes actifs"
                icon={WalletCards}
              />
              <SummaryCard
                title="Comptes actifs"
                value={String(data?.summary.activeCount ?? 0)}
                description="Ajoutés manuellement"
                icon={CreditCard}
              />
              <SummaryCard
                title="Compte principal"
                value={data?.summary.primaryAccount?.name ?? "Aucun"}
                description={
                  data?.summary.primaryAccount
                    ? formatMoney(data.summary.primaryAccount.currentBalance)
                    : "À définir"
                }
                icon={Star}
              />
              <SummaryCard
                title="Dernière activité"
                value={
                  data?.summary.lastActivity
                    ? dateFormatter.format(
                        new Date(data.summary.lastActivity)
                      )
                    : "Aucune"
                }
                description="Dernière transaction"
                icon={CalendarClock}
              />
            </div>

            <section aria-labelledby="active-accounts" className="space-y-4">
              <div>
                <h2
                  id="active-accounts"
                  className="text-2xl font-semibold text-white"
                >
                  Mes comptes
                </h2>
                <p className="text-sm text-muted-foreground">
                  Soldes calculés depuis le solde initial et les transactions.
                </p>
              </div>

              {activeAccounts.length === 0 ? (
                <Card className="border-dashed border-white/10 bg-white/[0.02]">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aucun compte actif.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {activeAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={(selectedAccount) => {
                        setAccountToEdit(selectedAccount)
                        setDialogOpen(true)
                      }}
                      onArchive={(selectedAccount) =>
                        void updateStatus(selectedAccount)
                      }
                      onDelete={(selectedAccount) => {
                        setActionError("")
                        setAccountToDelete(selectedAccount)
                      }}
                    />
                  ))}
                </div>
              )}
            </section>

            {archivedAccounts.length > 0 && (
              <section aria-labelledby="archived-accounts" className="space-y-4">
                <h2
                  id="archived-accounts"
                  className="text-xl font-semibold text-white"
                >
                  Comptes archivés
                </h2>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {archivedAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onEdit={(selectedAccount) => {
                        setAccountToEdit(selectedAccount)
                        setDialogOpen(true)
                      }}
                      onArchive={(selectedAccount) =>
                        void updateStatus(selectedAccount)
                      }
                      onDelete={(selectedAccount) => {
                        setActionError("")
                        setAccountToDelete(selectedAccount)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            <Card className="border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
              <CardContent className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                    <Link2 aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        Connecter un compte bancaire
                      </h2>
                      <Badge className="bg-violet-500/10 text-violet-300">
                        Bientôt disponible
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Synchronisez automatiquement vos comptes et vos
                      transactions bancaires.
                    </p>
                  </div>
                </div>
                <Button disabled variant="outline">
                  Connexion bancaire à venir
                </Button>
              </CardContent>
            </Card>

            <SharedSpacesPreview />
          </>
        )}
      </div>
    </>
  )
}
