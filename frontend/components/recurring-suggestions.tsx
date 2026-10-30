"use client"

import { notifyFinanceChanged, subscribeFinanceChanges } from "@/lib/finance-events"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, CheckCircle2, Clock3, EyeOff, WalletCards } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getRecurringConfirmErrorMessage,
  getRecurringConfirmationDefaults,
  validateRecurringConfirmation,
  type RecurringConfirmationFormValues,
} from "@/lib/recurring/confirmation-form"

type RecurringSuggestionConfidence = "POSSIBLE" | "HIGH"
type RecurringSuggestionType = "INCOME" | "EXPENSE"

type RecurringSuggestion = {
  suggestionId: string
  title: string
  type: RecurringSuggestionType
  estimatedAmount: number
  frequency: "MONTHLY"
  estimatedDayOfMonth: number
  confidence: RecurringSuggestionConfidence
  occurrenceCount: number
  categoryId: string | null
  category: {
    id: string
    name: string
    type: RecurringSuggestionType | "TRANSFER"
  } | null
  accountId: string | null
  account: {
    id: string
    name: string
  } | null
  occurrences: {
    transactionId: string
    date: string
    amount: number
    title: string
  }[]
}

type RecurringSuggestionsResponse = {
  suggestions: RecurringSuggestion[]
}

type CategoryOption = {
  id: string
  name: string
  type: RecurringSuggestionType
}

type CategoriesResponse = {
  categories: CategoryOption[]
  message?: string
}

type AccountOption = {
  id: string
  name: string
  status: "ACTIVE" | "ARCHIVED"
  isPrimary: boolean
}

type AccountsResponse = {
  accounts: AccountOption[]
  message?: string
}

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const emptyFormValues: RecurringConfirmationFormValues = {
  title: "",
  amount: 0,
  categoryId: "",
  accountId: "",
  frequency: "MONTHLY",
  dayOfMonth: 1,
  active: true,
  startDate: "",
  endDate: "",
}

async function requestRecurringSuggestions(signal?: AbortSignal) {
  const response = await fetch("/api/recurring-transactions/suggestions", {
    signal,
  })

  if (!response.ok) {
    throw new Error("Impossible de charger les suggestions.")
  }

  const data = (await response.json()) as RecurringSuggestionsResponse

  return data.suggestions
}

function getConfidenceLabel(confidence: RecurringSuggestionConfidence) {
  return confidence === "HIGH" ? "Confiance élevée" : "Récurrence possible"
}

function getTypeLabel(type: RecurringSuggestionType) {
  return type === "INCOME" ? "Revenu" : "Dépense"
}

function getFrequencyLabel() {
  return "mensuel"
}

export function RecurringSuggestions({ onConfirmed }: { onConfirmed?: () => void } = {}) {
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([])
  const [hiddenSuggestionIds, setHiddenSuggestionIds] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<RecurringSuggestion | null>(null)
  const [formValues, setFormValues] =
    useState<RecurringConfirmationFormValues>(emptyFormValues)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState("")
  const [optionsError, setOptionsError] = useState("")
  const [confirmError, setConfirmError] = useState("")

  const fetchSuggestions = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const nextSuggestions = await requestRecurringSuggestions(signal)

        setSuggestions(nextSuggestions)
        setError("")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setError("Impossible de charger les transactions récurrentes détectées.")
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => subscribeFinanceChanges(() => void fetchSuggestions()), [fetchSuggestions])

  useEffect(() => {
    const controller = new AbortController()

    requestRecurringSuggestions(controller.signal)
      .then((nextSuggestions) => {
        setSuggestions(nextSuggestions)
        setError("")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setError("Impossible de charger les transactions récurrentes détectées.")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  async function fetchOptions() {
    try {
      setIsOptionsLoading(true)
      setOptionsError("")

      const [categoriesResponse, accountsResponse] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/accounts"),
      ])
      const categoriesData =
        (await categoriesResponse.json()) as CategoriesResponse
      const accountsData = (await accountsResponse.json()) as AccountsResponse

      if (!categoriesResponse.ok) {
        throw new Error(
          categoriesData.message ?? "Impossible de charger les catégories."
        )
      }

      if (!accountsResponse.ok) {
        throw new Error(
          accountsData.message ?? "Impossible de charger les comptes."
        )
      }

      setCategories(categoriesData.categories)
      setAccounts(accountsData.accounts)
      setFormValues((currentValues) => {
        const expenseCategories = categoriesData.categories.filter(
          (category) => category.type === "EXPENSE"
        )
        const activeAccounts = accountsData.accounts.filter(
          (account) => account.status === "ACTIVE"
        )

        return {
          ...currentValues,
          categoryId:
            currentValues.categoryId || expenseCategories[0]?.id || "",
          accountId: currentValues.accountId || activeAccounts[0]?.id || "",
        }
      })
    } catch (error) {
      setOptionsError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les données du formulaire."
      )
    } finally {
      setIsOptionsLoading(false)
    }
  }

  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (suggestion) => !hiddenSuggestionIds.has(suggestion.suggestionId)
      ),
    [hiddenSuggestionIds, suggestions]
  )
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "EXPENSE"),
    [categories]
  )
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "ACTIVE"),
    [accounts]
  )
  const selectedSuggestionAmount = selectedSuggestion
    ? euroFormatter.format(selectedSuggestion.estimatedAmount)
    : ""

  function updateFormValue<ValueKey extends keyof RecurringConfirmationFormValues>(
    key: ValueKey,
    value: RecurringConfirmationFormValues[ValueKey]
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
    setConfirmError("")
  }

  function openConfirmDialog(suggestion: RecurringSuggestion) {
    setSelectedSuggestion(suggestion)
    setFormValues(getRecurringConfirmationDefaults(suggestion))
    setConfirmError("")
    setOptionsError("")
    void fetchOptions()
  }

  function closeConfirmDialog(open: boolean) {
    if (open) return
    if (isConfirming) return

    setSelectedSuggestion(null)
    setConfirmError("")
    setOptionsError("")
  }

  function hideSuggestion(suggestionId: string) {
    setHiddenSuggestionIds((currentIds) => {
      const nextIds = new Set(currentIds)

      nextIds.add(suggestionId)

      return nextIds
    })
  }

  async function confirmSuggestion() {
    if (!selectedSuggestion || isConfirming) return

    const validation = validateRecurringConfirmation({
      suggestionId: selectedSuggestion.suggestionId,
      values: formValues,
    })

    if (!validation.success) {
      setConfirmError(validation.message)
      return
    }

    try {
      setIsConfirming(true)
      setConfirmError("")

      const response = await fetch("/api/recurring-transactions/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.payload),
      })
      const data = (await response.json()) as {
        message?: string
        errors?: {
          formErrors?: string[]
          fieldErrors?: Record<string, string[] | undefined>
        }
      }

      if (response.status === 201) {
        setSelectedSuggestion(null)
        onConfirmed?.()
        notifyFinanceChanged(false)
        await fetchSuggestions()
        return
      }

      setConfirmError(getRecurringConfirmErrorMessage(response.status, data))

      if (response.status === 404 || response.status === 409) {
        await fetchSuggestions()
      }
    } catch {
      setConfirmError(
        "Impossible de contacter le serveur. Vos modifications sont conservées."
      )
    } finally {
      setIsConfirming(false)
    }
  }

  if (!isLoading && !error && visibleSuggestions.length === 0) {
    return null
  }

  return (
    <>
      <Dialog open={selectedSuggestion !== null} onOpenChange={closeConfirmDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer la dépense récurrente</DialogTitle>
            <DialogDescription>
              Le libellé choisi n’altère pas les transactions historiques.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void confirmSuggestion()
            }}
          >
            <FieldGroup className="gap-5">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-red-400/25 bg-red-500/10 text-red-200"
                  >
                    Dépense
                  </Badge>
                  <Badge variant="outline" className="text-white/70">
                    Mensuel
                  </Badge>
                </div>
                {selectedSuggestion && (
                  <p className="mt-2 text-muted-foreground">
                    Suggestion détectée :{" "}
                    <span className="font-medium text-white">
                      {selectedSuggestion.title}
                    </span>{" "}
                    à environ{" "}
                    <span className="font-medium text-white">
                      {selectedSuggestionAmount}
                    </span>
                    .
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="recurring-title">Libellé</FieldLabel>
                  <Input
                    id="recurring-title"
                    value={formValues.title}
                    onChange={(event) =>
                      updateFormValue("title", event.target.value)
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-amount">Montant</FieldLabel>
                  <Input
                    id="recurring-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formValues.amount}
                    onChange={(event) =>
                      updateFormValue(
                        "amount",
                        event.target.valueAsNumber || 0
                      )
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-category">Catégorie</FieldLabel>
                  <Select
                    value={formValues.categoryId}
                    disabled={isOptionsLoading || Boolean(optionsError)}
                    onValueChange={(value) =>
                      updateFormValue("categoryId", value)
                    }
                  >
                    <SelectTrigger id="recurring-category" className="w-full">
                      <SelectValue
                        placeholder={
                          isOptionsLoading
                            ? "Chargement..."
                            : "Choisir une catégorie"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isOptionsLoading &&
                    !optionsError &&
                    expenseCategories.length === 0 && (
                      <FieldError>
                        Aucune catégorie de dépense disponible.
                      </FieldError>
                    )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-account">Compte</FieldLabel>
                  <Select
                    value={formValues.accountId}
                    disabled={isOptionsLoading || Boolean(optionsError)}
                    onValueChange={(value) => updateFormValue("accountId", value)}
                  >
                    <SelectTrigger id="recurring-account" className="w-full">
                      <SelectValue
                        placeholder={
                          isOptionsLoading ? "Chargement..." : "Choisir un compte"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                          {account.isPrimary ? " · Principal" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isOptionsLoading &&
                    !optionsError &&
                    activeAccounts.length === 0 && (
                      <FieldError>Aucun compte actif disponible.</FieldError>
                    )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-day">
                    Jour du mois
                  </FieldLabel>
                  <Input
                    id="recurring-day"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={formValues.dayOfMonth}
                    onChange={(event) =>
                      updateFormValue(
                        "dayOfMonth",
                        Math.trunc(event.target.valueAsNumber || 0)
                      )
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel>Fréquence</FieldLabel>
                  <Input value="Mensuelle" disabled readOnly />
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-start-date">
                    Date de début
                  </FieldLabel>
                  <Input
                    id="recurring-start-date"
                    type="date"
                    value={formValues.startDate}
                    onChange={(event) =>
                      updateFormValue("startDate", event.target.value)
                    }
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="recurring-end-date">
                    Date de fin
                  </FieldLabel>
                  <Input
                    id="recurring-end-date"
                    type="date"
                    value={formValues.endDate}
                    onChange={(event) =>
                      updateFormValue("endDate", event.target.value)
                    }
                  />
                </Field>
              </div>

              <Field orientation="horizontal" className="items-center">
                <Checkbox
                  id="recurring-active"
                  checked={formValues.active}
                  onCheckedChange={(checked) =>
                    updateFormValue("active", checked === true)
                  }
                />
                <FieldLabel htmlFor="recurring-active">Active</FieldLabel>
              </Field>

              {optionsError && <FieldError>{optionsError}</FieldError>}
              {confirmError && <FieldError>{confirmError}</FieldError>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isConfirming}
                  onClick={() => closeConfirmDialog(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isConfirming ||
                    isOptionsLoading ||
                    Boolean(optionsError) ||
                    expenseCategories.length === 0 ||
                    activeAccounts.length === 0
                  }
                >
                  {isConfirming ? "Validation..." : "Valider"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a]">
        <CardHeader className="gap-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-white">
                <CalendarClock className="size-5 text-violet-300" aria-hidden="true" />
                Dépenses récurrentes détectées
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Suggestions calculées automatiquement à partir de vos dépenses.
              </p>
            </div>

            {!isLoading && !error && visibleSuggestions.length > 0 && (
              <Badge
                variant="outline"
                className="w-fit border-violet-400/25 bg-violet-500/10 text-violet-200"
              >
                {visibleSuggestions.length} suggestion
                {visibleSuggestions.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 p-4">
                  <Skeleton className="mb-4 h-5 w-32" />
                  <Skeleton className="mb-2 h-7 w-40" />
                  <Skeleton className="mb-5 h-4 w-56" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          {!isLoading && !error && visibleSuggestions.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleSuggestions.map((suggestion) => (
                <article
                  key={suggestion.suggestionId}
                  className="flex min-w-0 flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:border-violet-500/40"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-base font-semibold text-white">
                        {suggestion.title}
                      </h2>
                      <p
                        className={`mt-1 text-lg font-semibold ${
                          suggestion.type === "INCOME"
                            ? "text-green-400"
                            : "text-red-300"
                        }`}
                      >
                        ≈ {euroFormatter.format(suggestion.estimatedAmount)} /{" "}
                        {getFrequencyLabel()}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        suggestion.type === "INCOME"
                          ? "border-green-400/25 bg-green-500/10 text-green-300"
                          : "border-red-400/25 bg-red-500/10 text-red-200"
                      }
                    >
                      {getTypeLabel(suggestion.type)}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-sm text-white/70">
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock3 className="size-4 shrink-0 text-violet-300" aria-hidden="true" />
                      <span>
                        {suggestion.occurrenceCount} opération
                        {suggestion.occurrenceCount > 1 ? "s" : ""} détectée
                        {suggestion.occurrenceCount > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2
                        className="size-4 shrink-0 text-violet-300"
                        aria-hidden="true"
                      />
                      <span>{getConfidenceLabel(suggestion.confidence)}</span>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <WalletCards
                        className="size-4 shrink-0 text-violet-300"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate">
                        {suggestion.account?.name ?? "Compte non renseigné"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {suggestion.category?.name && (
                      <Badge
                        variant="outline"
                        className="border-violet-400/25 bg-violet-500/10 text-violet-200"
                      >
                        {suggestion.category.name}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-white/70">
                      Jour estimé {suggestion.estimatedDayOfMonth}
                    </Badge>
                  </div>

                  <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="justify-center text-white/70 hover:text-white"
                      onClick={() => hideSuggestion(suggestion.suggestionId)}
                    >
                      <EyeOff className="size-4" aria-hidden="true" />
                      Pas maintenant
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openConfirmDialog(suggestion)}
                    >
                      Confirmer
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
