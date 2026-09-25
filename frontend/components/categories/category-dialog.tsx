"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { CategoryIcon } from "@/components/categories/category-icon"
import type { CategoryItem } from "@/components/categories/types"
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
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from "@/lib/categories/constants"
import { categorySchema } from "@/lib/validations/category"

type CategoryFormValues = z.input<typeof categorySchema>

type CategoryDialogProps = {
  category: CategoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const defaultValues: CategoryFormValues = {
  name: "",
  type: "EXPENSE",
  icon: "shapes",
  color: "#8b5cf6",
}

export function CategoryDialog({
  category,
  open,
  onOpenChange,
  onSaved,
}: CategoryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState("")
  const isEditing = category !== null
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues,
    values: category
      ? {
          name: category.name,
          type: category.type,
          icon: category.icon as CategoryFormValues["icon"],
          color: category.color,
        }
      : defaultValues,
  })
  const selectedType = useWatch({ control, name: "type" })
  const selectedIcon = useWatch({ control, name: "icon" })
  const selectedColor = useWatch({ control, name: "color" })

  async function onSubmit(values: CategoryFormValues) {
    try {
      setIsSubmitting(true)
      setApiError("")

      const response = await fetch(
        isEditing ? `/api/categories/${category.id}` : "/api/categories",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      )
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? "Impossible d’enregistrer la catégorie.")
      }

      toast.success(
        isEditing
          ? "Catégorie modifiée avec succès."
          : "Catégorie créée avec succès."
      )
      onOpenChange(false)
      onSaved()
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la catégorie."
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
            reset(defaultValues)
          }
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </DialogTitle>
          <DialogDescription>
            Personnalisez le classement de vos transactions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="category-name">Nom</FieldLabel>
              <Input
                id="category-name"
                placeholder="Ex. Alimentation"
                maxLength={50}
                {...register("name")}
              />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="category-type">Type</FieldLabel>
              <Select
                value={selectedType}
                disabled={Boolean(category && category.transactionCount > 0)}
                onValueChange={(value) =>
                  setValue("type", value as "INCOME" | "EXPENSE", {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="category-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Dépense</SelectItem>
                  <SelectItem value="INCOME">Revenu</SelectItem>
                </SelectContent>
              </Select>
              {category && category.transactionCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Le type est verrouillé car cette catégorie est déjà utilisée.
                </p>
              )}
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="category-icon">Icône</FieldLabel>
              <Select
                value={selectedIcon}
                onValueChange={(value) =>
                  setValue(
                    "icon",
                    value as CategoryFormValues["icon"],
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger id="category-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={option.value} className="size-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.icon && <FieldError>{errors.icon.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="category-color">Couleur</FieldLabel>
              <div className="flex min-w-0 items-center gap-3">
                <Input
                  id="category-color"
                  type="color"
                  className="h-11 w-16 shrink-0 cursor-pointer p-1"
                  {...register("color")}
                />
                <div className="flex min-w-0 flex-wrap gap-2">
                  {CATEGORY_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Choisir la couleur ${color}`}
                      aria-pressed={selectedColor === color}
                      className="size-7 rounded-full border-2 border-transparent outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-white"
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setValue("color", color, { shouldValidate: true })
                      }
                    />
                  ))}
                </div>
              </div>
              {errors.color && <FieldError>{errors.color.message}</FieldError>}
            </Field>

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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Enregistrement..."
                : isEditing
                  ? "Enregistrer"
                  : "Créer la catégorie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
