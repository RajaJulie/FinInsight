"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AccountIcon } from "@/components/accounts/account-icon"
import type { AccountItem } from "@/components/accounts/types"
import { Button } from "@/components/ui/button"
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
import {
  ACCOUNT_COLOR_OPTIONS,
  ACCOUNT_ICON_OPTIONS,
  ACCOUNT_TYPE_OPTIONS,
} from "@/lib/accounts/constants"
import { accountSchema } from "@/lib/validations/account"

type AccountFormValues = z.input<typeof accountSchema>

type AccountDialogProps = {
  account: AccountItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const defaultValues: AccountFormValues = {
  name: "",
  type: "CHECKING",
  initialBalance: 0,
  currency: "EUR",
  icon: "wallet",
  color: "#8b5cf6",
  isPrimary: false,
}

export function AccountDialog({
  account,
  open,
  onOpenChange,
  onSaved,
}: AccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState("")
  const isEditing = account !== null
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues,
    values: account
      ? {
          name: account.name,
          type: account.type,
          initialBalance: account.initialBalance,
          currency: "EUR",
          icon: account.icon as AccountFormValues["icon"],
          color: account.color,
          isPrimary: account.isPrimary,
        }
      : defaultValues,
  })
  const selectedType = useWatch({ control, name: "type" })
  const selectedIcon = useWatch({ control, name: "icon" })
  const selectedColor = useWatch({ control, name: "color" })
  const isPrimary = useWatch({ control, name: "isPrimary" })

  async function onSubmit(values: AccountFormValues) {
    try {
      setIsSubmitting(true)
      setApiError("")
      const response = await fetch(
        isEditing ? `/api/accounts/${account.id}` : "/api/accounts",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      )
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? "Impossible d’enregistrer le compte.")
      }

      toast.success(
        isEditing ? "Compte modifié avec succès." : "Compte créé avec succès."
      )
      onOpenChange(false)
      onSaved()
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le compte."
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
            {isEditing ? "Modifier le compte" : "Ajouter un compte"}
          </DialogTitle>
          <DialogDescription>
            Ajoutez un compte manuel. Aucune connexion bancaire n’est effectuée.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">Nom</FieldLabel>
              <Input
                id="account-name"
                placeholder="Ex. Livret A, Revolut, Assurance Vie AXA"
                maxLength={50}
                {...register("name")}
              />
              <p className="text-xs text-muted-foreground">
                Le nom est libre et permet d’identifier votre produit financier.
              </p>
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="account-type">Type</FieldLabel>
              <Select
                value={selectedType}
                onValueChange={(value) =>
                  setValue("type", value as AccountFormValues["type"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Le type permet à FinInsight de calculer votre patrimoine et
                votre épargne.
              </p>
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="initial-balance">Solde initial</FieldLabel>
                <Input
                  id="initial-balance"
                  type="number"
                  step="0.01"
                  {...register("initialBalance")}
                />
                {errors.initialBalance && (
                  <FieldError>{errors.initialBalance.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="account-currency">Devise</FieldLabel>
                <Select value="EUR" disabled>
                  <SelectTrigger id="account-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Une seule devise pour le MVP.
                </p>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="account-icon">Icône</FieldLabel>
              <Select
                value={selectedIcon}
                onValueChange={(value) =>
                  setValue("icon", value as AccountFormValues["icon"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="account-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <AccountIcon icon={option.value} className="size-4" />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.icon && <FieldError>{errors.icon.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="account-color">Couleur</FieldLabel>
              <div className="flex min-w-0 items-center gap-3">
                <Input
                  id="account-color"
                  type="color"
                  className="h-11 w-16 shrink-0 cursor-pointer p-1"
                  {...register("color")}
                />
                <div className="flex min-w-0 flex-wrap gap-2">
                  {ACCOUNT_COLOR_OPTIONS.map((color) => (
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

            <Field orientation="horizontal">
              <Checkbox
                id="account-primary"
                checked={isPrimary}
                onCheckedChange={(checked) =>
                  setValue("isPrimary", checked === true, {
                    shouldValidate: true,
                  })
                }
              />
              <div>
                <FieldLabel htmlFor="account-primary">
                  Définir comme compte principal
                </FieldLabel>
                <p className="text-xs text-muted-foreground">
                  Il sera mis en avant dans les indicateurs.
                </p>
              </div>
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
                  : "Ajouter le compte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
