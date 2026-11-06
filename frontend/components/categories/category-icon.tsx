/**
 * Traduit les identifiants d'icones des categories en composants Lucide.
 * Utilise une icone de remplacement pour les valeurs non reconnues.
 */
import {
  BriefcaseBusiness,
  Car,
  CircleDollarSign,
  Gamepad2,
  HeartPulse,
  House,
  Repeat2,
  RotateCcw,
  Shapes,
  ShoppingBag,
  Sparkles,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react"

const categoryIcons: Record<string, LucideIcon> = {
  utensils: Utensils,
  house: House,
  car: Car,
  "shopping-bag": ShoppingBag,
  gamepad: Gamepad2,
  "heart-pulse": HeartPulse,
  repeat: Repeat2,
  shapes: Shapes,
  "wallet-cards": WalletCards,
  sparkles: Sparkles,
  briefcase: BriefcaseBusiness,
  "rotate-ccw": RotateCcw,
  "circle-dollar-sign": CircleDollarSign,
}

export function CategoryIcon({
  icon,
  className,
}: {
  icon: string
  className?: string
}) {
  const Icon = categoryIcons[icon] ?? Shapes

  return <Icon aria-hidden="true" className={className} />
}
