/**
 * Associe les identifiants d'icones des comptes aux composants Lucide.
 * Fournit une icone de remplacement lorsque l'identifiant n'est pas reconnu.
 */
import {
  Banknote,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PiggyBank,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

const accountIcons: Record<string, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  users: Users,
  "credit-card": CreditCard,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "circle-dollar-sign": CircleDollarSign,
}

export function AccountIcon({
  icon,
  className,
}: {
  icon: string
  className?: string
}) {
  const Icon = accountIcons[icon] ?? Wallet

  return <Icon aria-hidden="true" className={className} />
}
