"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { CategoryIcon } from "@/components/categories/category-icon"
import { Button } from "@/components/ui/button"
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
import { budgetSchema } from "@/lib/validations/budget"

type BudgetFormInput = z.input<typeof budgetSchema>
type BudgetFormValues = z.output<typeof budgetSchema>

type BudgetCategory = {
  id: string
  name: string
  type: "INCOME" | "EXPENSE"
  icon: string
  color: string
}

type CategoriesResponse = {
  categories: BudgetCategory[]
}

export type BudgetItem = {
  id: string
  amount: number
  month: number
  year: number
  categoryId: string
  spent: number
  remaining: number
  percentage: number
  category: {
    id: string
    name: string
    icon: string
    color: string
  }
}

type BudgetDialogProps = {
  budget: BudgetItem | null
  open: boolean
  month: number
  year: number
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const monthOptions = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
]

function getDefaultValues(month: number, year: number): BudgetFormInput {
  return {
    categoryId: "",
    amount: 0,
    month,
    year,
  }
}

async function requestExpenseCategories() {
  const response = await fetch("/api/categories")
  const data = (await response.json()) as CategoriesResponse & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message ?? "Impossible de charger les catégories.")
  }

  return data.categories.filter((category) => category.type === "EXPENSE")
}

export function BudgetDialog({
  budget,
  open,
  month,
  year,
  onOpenChange,
  onSaved,
}: BudgetDialogProps) {
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoriesError, setCategoriesError] = useState("")
  const [apiError, setApiError] = useState("")
  const isEditing = budget !== null

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: getDefaultValues(month, year),
    values: budget
      ? {
          categoryId: budget.categoryId,
          amount: budget.amount,
          month: budget.month,
          year: budget.year,
        }
      : getDefaultValues(month, year),
  })
  const selectedCategoryId = useWatch({ control, name: "categoryId" })
  const selectedMonth = useWatch({ control, name: "month" })

  useEffect(() => {
    if (!open) {
      return
    }

    let isMounted = true

    requestExpenseCategories()
      .then((nextCategories) => {
        if (isMounted) {
          setCategories(nextCategories)
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setCategoriesError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les catégories."
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCategoriesLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [open])

  async function onSubmit(values: BudgetFormValues) {
    try {
      setIsSubmitting(true)
      setApiError("")

      const response = await fetch(
        isEditing ? `/api/budgets/${budget.id}` : "/api/budgets",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      )
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? "Impossible d’enregistrer le budget.")
      }

      toast.success(
        isEditing ? "Budget modifié avec succès." : "Budget créé avec succès."
      )
      onOpenChange(false)
      onSaved()
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le budget."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          if (!nextOpen) {
            setApiError("")
            setCategoriesError("")
            reset(getDefaultValues(month, year))
          }
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le budget" : "Nouveau budget"}
          </DialogTitle>
          <DialogDescription>
            Définissez une limite mensuelle pour une catégorie de dépense.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="budget-category">Catégorie</FieldLabel>
              <Select
                value={selectedCategoryId}
                disabled={isCategoriesLoading || Boolean(categoriesError)}
                onValueChange={(value) =>
                  setValue("categoryId", value, { shouldValidate: true })
                }
              >
                <SelectTrigger id="budget-category">
                  <SelectValue
                    placeholder={
                      isCategoriesLoading
                        ? "Chargement..."
                        : "Sélectionner une catégorie"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={category.icon} className="size-4" />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoriesError && <FieldError>{categoriesError}</FieldError>}
              {!isCategoriesLoading &&
                !categoriesError &&
                categories.length === 0 && (
                  <FieldError>
                    Aucune catégorie de dépense disponible.
                  </FieldError>
                )}
              {errors.categoryId && (
                <FieldError>{errors.categoryId.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="budget-amount">Limite mensuelle</FieldLabel>
              <Input
                id="budget-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="400"
                {...register("amount")}
              />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="budget-month">Mois</FieldLabel>
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(value) =>
                    setValue("month", Number(value), {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="budget-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.month && <FieldError>{errors.month.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="budget-year">Année</FieldLabel>
                <Input
                  id="budget-year"
                  type="number"
                  min="2000"
                  max="2100"
                  {...register("year")}
                />
                {errors.year && <FieldError>{errors.year.message}</FieldError>}
              </Field>
            </div>

            {apiError && <FieldError>{apiError}</FieldError>}
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                isCategoriesLoading ||
                Boolean(categoriesError) ||
                categories.length === 0
              }
            >
              {isSubmitting
                ? "Enregistrement..."
                : isEditing
                  ? "Enregistrer"
                  : "Créer le budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
