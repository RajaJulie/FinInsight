"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { CategoryAnalysis } from "@/components/categories/category-analysis"
import { CategoryDialog } from "@/components/categories/category-dialog"
import { CategoryIcon } from "@/components/categories/category-icon"
import type {
  CategoriesResponse,
  CategoryItem,
  CategoryType,
} from "@/components/categories/types"
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

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

async function requestCategories() {
  const response = await fetch("/api/categories")
  const data = (await response.json()) as CategoriesResponse & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message ?? "Impossible de charger les catégories.")
  }

  return data
}

function CategoryCard({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryItem
  onEdit: (category: CategoryItem) => void
  onDelete: (category: CategoryItem) => void
}) {
  return (
    <Card className="min-w-0 border-[#13223a] bg-gradient-to-t from-[#071226] to-[#0b1d3a] transition hover:border-violet-500/40">
      <CardHeader className="min-w-0 pb-0">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <CategoryIcon icon={category.icon} className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{category.name}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  category.type === "EXPENSE"
                    ? "border-red-500/30 text-red-300"
                    : "border-green-500/30 text-green-300"
                }
              >
                {category.type === "EXPENSE" ? "Dépense" : "Revenu"}
              </Badge>
              {category.isDefault && (
                <span className="text-xs text-muted-foreground">Par défaut</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4">
        <div className="grid min-w-0 grid-cols-2 gap-3 rounded-xl bg-white/5 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="truncate font-semibold text-white">
              {category.transactionCount}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs text-muted-foreground">Ce mois</p>
            <p className="truncate font-semibold text-white">
              {euroFormatter.format(category.monthlyAmount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`Modifier ${category.name}`}
            onClick={() => onEdit(category)}
          >
            <Pencil aria-hidden="true" className="size-4" />
            Modifier
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Supprimer ${category.name}`}
            onClick={() => onDelete(category)}
          >
            <Trash2 aria-hidden="true" className="size-4 text-red-400" />
            Supprimer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryGroup({
  title,
  description,
  type,
  categories,
  onEdit,
  onDelete,
}: {
  title: string
  description: string
  type: CategoryType
  categories: CategoryItem[]
  onEdit: (category: CategoryItem) => void
  onDelete: (category: CategoryItem) => void
}) {
  const filteredCategories = categories.filter((category) => category.type === type)

  return (
    <section aria-labelledby={`categories-${type.toLowerCase()}`}>
      <div className="mb-4">
        <h2
          id={`categories-${type.toLowerCase()}`}
          className="text-xl font-semibold text-white"
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {filteredCategories.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-white/[0.02]">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune catégorie dans cette section.
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryToEdit, setCategoryToEdit] = useState<CategoryItem | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0)

  const loadCategories = useCallback(async () => {
    try {
      setLoadError("")
      const data = await requestCategories()

      setCategories(data.categories)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les catégories."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    requestCategories()
      .then((data) => {
        if (isMounted) {
          setCategories(data.categories)
          setLoadError("")
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les catégories."
          )
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshCategoriesAndAnalysis() {
    await loadCategories()
    setAnalysisRefreshKey((currentKey) => currentKey + 1)
  }

  async function handleDelete() {
    if (!categoryToDelete) {
      return
    }

    try {
      setIsDeleting(true)
      setDeleteError("")
      const response = await fetch(`/api/categories/${categoryToDelete.id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { message?: string }

      if (!response.ok) {
        throw new Error(data.message ?? "Impossible de supprimer la catégorie.")
      }

      toast.success("Catégorie supprimée avec succès.")
      setCategoryToDelete(null)
      await refreshCategoriesAndAnalysis()
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Impossible de supprimer la catégorie."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  return (
    <>
      <CategoryDialog
        category={categoryToEdit}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setCategoryToEdit(null)
          }
        }}
        onSaved={() => void refreshCategoriesAndAnalysis()}
      />

      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setCategoryToDelete(null)
            setDeleteError("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              La suppression est définitive. Une catégorie utilisée par des
              transactions sera automatiquement protégée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-red-400">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Catégories</h1>
            <p className="text-muted-foreground">
              Analysez la répartition de vos revenus et de vos dépenses
            </p>
          </div>
          <Button
            className="bg-gradient-to-r from-violet-600 to-cyan-500"
            onClick={() => {
              setCategoryToEdit(null)
              setDialogOpen(true)
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Nouvelle catégorie
          </Button>
        </div>

        <CategoryAnalysis refreshKey={analysisRefreshKey} />

        <section aria-labelledby="manage-categories" className="space-y-6">
          <div>
            <h2 id="manage-categories" className="text-2xl font-semibold text-white">
              Gérer mes catégories
            </h2>
            <p className="text-sm text-muted-foreground">
              Personnalisez les catégories utilisées par vos transactions.
            </p>
          </div>

        {loadError ? (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p role="alert" className="text-red-300">{loadError}</p>
              <Button variant="outline" onClick={() => void loadCategories()}>
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <CategoryGroup
              title="Catégories de dépenses"
              description="Classez et analysez vos sorties d’argent."
              type="EXPENSE"
              categories={categories}
              onEdit={(category) => {
                setCategoryToEdit(category)
                setDialogOpen(true)
              }}
              onDelete={(category) => {
                setDeleteError("")
                setCategoryToDelete(category)
              }}
            />

            <CategoryGroup
              title="Catégories de revenus"
              description="Organisez les différentes sources de revenus."
              type="INCOME"
              categories={categories}
              onEdit={(category) => {
                setCategoryToEdit(category)
                setDialogOpen(true)
              }}
              onDelete={(category) => {
                setDeleteError("")
                setCategoryToDelete(category)
              }}
            />
          </>
        )}
        </section>
      </div>
    </>
  )
}
