"use client"

import { useState } from "react"
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

export function TransactionDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
    } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
        title: "",
        amount: 0,
        type: "EXPENSE",
        category: "",
        date: new Date().toISOString().split("T")[0],
    },
    })

  const onSubmit: SubmitHandler <TransactionFormValues>  = async (values) => {
    setIsLoading(true)

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    })

    setIsLoading(false)

    if (!response.ok) {
      alert("Erreur lors de la création de la transaction.")
      return
    }

    reset()
    setOpen(false)
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-purple-600 to-cyan-500">
          <PlusCircle className="mr-2 size-4" />
          Ajouter une transaction
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une transaction</DialogTitle>
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
                defaultValue="EXPENSE"
                onValueChange={(value) =>
                  setValue("type", value as "INCOME" | "EXPENSE")
                }
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
              <Select onValueChange={(value) => setValue("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alimentation">Alimentation</SelectItem>
                  <SelectItem value="Transport">Transport</SelectItem>
                  <SelectItem value="Loisirs">Loisirs</SelectItem>
                  <SelectItem value="Shopping">Shopping</SelectItem>
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

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Ajout en cours..." : "Ajouter"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}