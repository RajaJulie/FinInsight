/**
 * Affiche un bloc de remplacement anime pendant le chargement.
 * Ses dimensions et classes sont definies par le composant qui l'utilise.
 */
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
