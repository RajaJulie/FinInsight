"use client"

import { type ReactNode, useEffect, useState } from "react"
import { z } from "zod"
import { SubmitHandler, useForm } from "react-hook-form"
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

const transactionSchema = z.object({
  title: z.string().min(1, "Le titre est obligatoire."),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0."),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1, "La catégorie est obligatoire."),
  date: z.string().min(1, "La date est obligatoire."),
})

type TransactionFormInput = z.input<typeof transactionSchema>
type TransactionFormValues = z.output<typeof transactionSchema>

type EditableTransaction = {
  id: string
  title: string
  amount: number
  type: "INCOME" | "EXPENSE"
  category: string
  date: string
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
  category: "",
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
  const [apiError, setApiError] = useState("")
  const [selectedType, setSelectedType] =
    useState<TransactionFormValues["type"]>()
  const [selectedCategory, setSelectedCategory] = useState<string>()
  const isEditing = Boolean(transaction)
  const open = controlledOpen ?? internalOpen

  function setOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen)
    setInternalOpen(nextOpen)

    if (!nextOpen) {
      setSelectedType(undefined)
      setSelectedCategory(undefined)
      setApiError("")
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    if (transaction) {
      reset({
        title: transaction.title,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
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
          body: JSON.stringify(values),
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
                value={selectedType ?? transaction?.type ?? defaultValues.type}
                onValueChange={(value) => {
                  const nextType = value as "INCOME" | "EXPENSE"
                  setSelectedType(nextType)
                  setValue("type", nextType, {
                    shouldValidate: true,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Dépense</SelectItem>
                  <SelectItem value="INCOME">Revenu</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel>Catégorie</FieldLabel>
              <Select
                value={
                  selectedCategory ??
                  transaction?.category ??
                  defaultValues.category
                }
                onValueChange={(value) => {
                  setSelectedCategory(value)
                  setValue("category", value, { shouldValidate: true })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alimentation">Alimentation</SelectItem>
                  <SelectItem value="Transport">Transport</SelectItem>
                  <SelectItem value="Loisirs">Loisirs</SelectItem>
                  <SelectItem value="Shopping">Shopping</SelectItem>
                  <SelectItem value="Santé">Santé</SelectItem>
                  <SelectItem value="Télécommunication">
                    Télécommunication
                  </SelectItem>
                  <SelectItem value="Assurance">Assurance</SelectItem>
                  <SelectItem value="Frais bancaires">
                    Frais bancaires
                  </SelectItem>
                  <SelectItem value="Impôts et taxes">
                    Impôts et taxes
                  </SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                  <SelectItem value="Revenus">Revenus</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <FieldError>{errors.category.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input type="date" {...register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>

            {apiError && <FieldError>{apiError}</FieldError>}

            <Button type="submit" disabled={isLoading}>
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
