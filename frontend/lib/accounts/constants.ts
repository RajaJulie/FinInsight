export const ACCOUNT_TYPE_VALUES = [
  "CHECKING",
  "SAVINGS",
  "CASH",
  "INVESTMENT",
  "CREDIT",
  "OTHER",
] as const

export const ACCOUNT_TYPE_OPTIONS = [
  { value: "CHECKING", label: "Compte courant" },
  { value: "SAVINGS", label: "Épargne" },
  { value: "CASH", label: "Espèces" },
  { value: "INVESTMENT", label: "Investissement" },
  { value: "CREDIT", label: "Crédit" },
  { value: "OTHER", label: "Autre" },
] as const

export const ACCOUNT_ICON_VALUES = [
  "wallet",
  "landmark",
  "piggy-bank",
  "banknote",
  "users",
  "credit-card",
  "chart-no-axes-combined",
  "circle-dollar-sign",
] as const

export const ACCOUNT_ICON_OPTIONS = [
  { value: "wallet", label: "Portefeuille" },
  { value: "landmark", label: "Banque" },
  { value: "piggy-bank", label: "Épargne" },
  { value: "banknote", label: "Espèces" },
  { value: "users", label: "Compte joint" },
  { value: "credit-card", label: "Carte" },
  { value: "chart-no-axes-combined", label: "Investissement" },
  { value: "circle-dollar-sign", label: "Autre" },
] as const

export const ACCOUNT_COLOR_OPTIONS = [
  "#8b5cf6",
  "#06b6d4",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#3b82f6",
  "#64748b",
] as const

export const DEFAULT_ACCOUNT = {
  name: "Compte principal",
  type: "CHECKING" as const,
  initialBalance: 0,
  currency: "EUR",
  icon: "wallet",
  color: "#8b5cf6",
  status: "ACTIVE" as const,
  isPrimary: true,
}
