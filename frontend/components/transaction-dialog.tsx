"use client"

import { type ReactNode, useEffect, useState } from "react"
import { z } from "zod"
import { SubmitHandler, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"

const transactionSchema = z
  .object({
    title: z.string().min(1, "Le titre est obligatoire."),
    amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    categoryId: z.string(),
    accountId: z.string().min(1, "Le compte source est obligatoire."),
    destinationAccountId: z.string(),
    date: z.string().min(1, "La date est obligatoire."),
  })
  .superRefine((data, context) => {
    if (data.type !== "TRANSFER" && !data.categoryId) {
      context.addIssue({
        code: "custom",
        message: "La catégorie est obligatoire.",
        path: ["categoryId"],
      })
    }

    if (data.type === "TRANSFER") {
      if (!data.destinationAccountId) {
        context.addIssue({
          code: "custom",
          message: "Le compte destination est obligatoire.",
          path: ["destinationAccountId"],
        })
      } else if (data.accountId === data.destinationAccountId) {
        context.addIssue({
          code: "custom",
          message: "Choisissez deux comptes différents.",
          path: ["destinationAccountId"],
        })
      }
    }
  })

type TransactionFormInput = z.input<typeof transactionSchema>
type TransactionFormValues = z.output<typeof transactionSchema>

type EditableTransaction = {
  id: string
  title: string
  amount: number
  type: "INCOME" | "EXPENSE" | "TRANSFER"
  category: string
  categoryId: string | null
  accountId: string | null
  destinationAccountId: string | null
  account: { id: string; name: string } | null
  destinationAccount: { id: string; name: string } | null
  date: string
}

type CategoryOption = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
}

type CategoriesResponse = {
  categories: CategoryOption[]
}

type AccountOption = {
  id: string
  name: string
  status: "ACTIVE" | "ARCHIVED"
  isPrimary: boolean
}

type AccountsResponse = {
  accounts: AccountOption[]
}

type TransactionDialogProps = {
  transaction?: EditableTransaction | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved?: (transaction: EditableTransaction) => void
  trigger?: ReactNode | null
}

const defaultValues: TransactionFormInput = {
  title: "",
  amount: 0,
  type: "EXPENSE",
  categoryId: "",
  accountId: "",
  destinationAccountId: "",
  date: new Date().toISOString().split("T")[0],
}

function toDateInputValue(date: string) {
  return new Date(date).toISOString().split("T")[0]
}

export function TransactionDialog({
  transaction,
  open: controlledOpen,
  onOpenChange,
  onSaved,
  trigger,
}: TransactionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false)
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categoriesError, setCategoriesError] = useState("")
  const [accountsError, setAccountsError] = useState("")
  const [apiError, setApiError] = useState("")
  const isEditing = Boolean(transaction)
  const open = controlledOpen ?? internalOpen

  function setOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen)
    setInternalOpen(nextOpen)

    if (!nextOpen) {
      setApiError("")
      setCategoriesError("")
      setAccountsError("")
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  })
  const selectedType = useWatch({ control, name: "type" })
  const selectedCategoryId = useWatch({ control, name: "categoryId" })
  const selectedAccountId = useWatch({ control, name: "accountId" })
  const selectedDestinationAccountId = useWatch({
    control,
    name: "destinationAccountId",
  })
  const availableCategories = categories.filter(
    (category) => category.type === selectedType
  )
  const activeAccounts = accounts.filter(
    (account) => account.status === "ACTIVE"
  )

  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()

    async function fetchOptions() {
      try {
        setIsCategoriesLoading(true)
        setIsAccountsLoading(true)
        setCategoriesError("")
        setAccountsError("")

        const [categoriesResponse, accountsResponse] = await Promise.all([
          fetch("/api/categories", { signal: controller.signal }),
          fetch("/api/accounts", { signal: controller.signal }),
        ])
        const categoriesData =
          (await categoriesResponse.json()) as CategoriesResponse & {
            message?: string
          }
        const accountsData =
          (await accountsResponse.json()) as AccountsResponse & {
            message?: string
          }

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

        if (!transaction?.accountId) {
          const defaultAccount =
            accountsData.accounts.find(
              (account) => account.status === "ACTIVE" && account.isPrimary
            ) ??
            accountsData.accounts.find(
              (account) => account.status === "ACTIVE"
            )

          if (defaultAccount) {
            setValue("accountId", defaultAccount.id, {
              shouldValidate: false,
            })
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Impossible de charger les données du formulaire."
        setCategoriesError(message)
        setAccountsError(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsCategoriesLoading(false)
          setIsAccountsLoading(false)
        }
      }
    }

    void fetchOptions()

    return () => controller.abort()
  }, [open, setValue, transaction?.accountId])

  useEffect(() => {
    if (!open) {
      return
    }

    if (transaction) {
      reset({
        title: transaction.title,
        amount: transaction.amount,
        type: transaction.type,
        categoryId: transaction.categoryId ?? "",
        accountId: transaction.accountId ?? "",
        destinationAccountId: transaction.destinationAccountId ?? "",
        date: toDateInputValue(transaction.date),
      })
      return
    }

    reset(defaultValues)
  }, [open, reset, transaction])

  const onSubmit: SubmitHandler<TransactionFormValues> = async (values) => {
    setIsLoading(true)
    setApiError("")

    try {
      const response = await fetch(
        isEditing
          ? `/api/transactions/${transaction?.id}`
          : "/api/transactions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            values.type === "TRANSFER"
              ? {
                  title: values.title,
                  amount: values.amount,
                  type: values.type,
                  accountId: values.accountId,
                  destinationAccountId: values.destinationAccountId,
                  date: values.date,
                }
              : {
                  title: values.title,
                  amount: values.amount,
                  type: values.type,
                  categoryId: values.categoryId,
                  accountId: values.accountId,
                  date: values.date,
                }
          ),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setApiError(
          data.message ?? "Erreur lors de l'enregistrement de la transaction."
        )
        return
      }

      const savedTransaction = isEditing ? data : data.transaction

      reset(defaultValues)
      setOpen(false)

      if (onSaved) {
        onSaved(savedTransaction)
        return
      }

      window.location.reload()
    } catch {
      setApiError("Impossible de contacter le serveur.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="bg-gradient-to-r from-purple-600 to-cyan-500">
              <PlusCircle className="mr-2 size-4" />
              Ajouter une transaction
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier la transaction" : "Ajouter une transaction"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel>Titre</FieldLabel>
              <Input placeholder="Courses Carrefour" {...register("title")} />
              {errors.title && <FieldError>{errors.title.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>Montant</FieldLabel>
              <Input type="number" step="0.01" {...register("amount")} />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                value={selectedType}
                onValueChange={(value) => {
                  const nextType = value as
                    | "INCOME"
                    | "EXPENSE"
                    | "TRANSFER"
                  setValue("type", nextType, {
                    shouldValidate: true,
                  })
                  setValue("categoryId", "", {
                    shouldValidate: false,
                  })
                  setValue("destinationAccountId", "", {
                    shouldValidate: false,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Dépense</SelectItem>
                  <SelectItem value="INCOME">Revenu</SelectItem>
                  <SelectItem value="TRANSFER">Virement interne</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>
                {selectedType === "TRANSFER" ? "Compte source" : "Compte"}
              </FieldLabel>
              <Select
                value={selectedAccountId}
                disabled={isAccountsLoading || Boolean(accountsError)}
                onValueChange={(value) => {
                  setValue("accountId", value, { shouldValidate: true })
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isAccountsLoading
                        ? "Chargement..."
                        : "Choisir un compte"
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
              {accountsError && <FieldError>{accountsError}</FieldError>}
              {!isAccountsLoading &&
                !accountsError &&
                activeAccounts.length === 0 && (
                  <FieldError>Aucun compte actif disponible.</FieldError>
                )}
              {errors.accountId && (
                <FieldError>{errors.accountId.message}</FieldError>
              )}
            </Field>

            {selectedType === "TRANSFER" && (
              <Field>
                <FieldLabel>Compte destination</FieldLabel>
                <Select
                  value={selectedDestinationAccountId}
                  disabled={isAccountsLoading || Boolean(accountsError)}
                  onValueChange={(value) => {
                    setValue("destinationAccountId", value, {
                      shouldValidate: true,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir le compte destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts
                      .filter((account) => account.id !== selectedAccountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.destinationAccountId && (
                  <FieldError>
                    {errors.destinationAccountId.message}
                  </FieldError>
                )}
              </Field>
            )}

            {selectedType !== "TRANSFER" && (
              <Field>
                <FieldLabel>Catégorie</FieldLabel>
                <Select
                  value={selectedCategoryId}
                  disabled={isCategoriesLoading || Boolean(categoriesError)}
                  onValueChange={(value) => {
                    setValue("categoryId", value, { shouldValidate: true })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isCategoriesLoading
                          ? "Chargement..."
                          : "Choisir une catégorie"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoriesError && <FieldError>{categoriesError}</FieldError>}
                {!isCategoriesLoading &&
                  !categoriesError &&
                  availableCategories.length === 0 && (
                    <FieldError>
                      Aucune catégorie disponible pour ce type.
                    </FieldError>
                  )}
                {errors.categoryId && (
                  <FieldError>{errors.categoryId.message}</FieldError>
                )}
              </Field>
            )}

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input type="date" {...register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>

            {apiError && <FieldError>{apiError}</FieldError>}

            <Button
              type="submit"
              disabled={
                isLoading ||
                isCategoriesLoading ||
                isAccountsLoading ||
                Boolean(accountsError) ||
                !selectedAccountId ||
                (selectedType === "TRANSFER"
                  ? !selectedDestinationAccountId
                  : Boolean(categoriesError) || !selectedCategoryId)
              }
            >
              {isLoading
                ? "Enregistrement..."
                : isEditing
                ? "Modifier"
                : "Ajouter"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
