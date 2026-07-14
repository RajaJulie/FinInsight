export type NavigationIcon =
  | "dashboard"
  | "transactions"
  | "categories"
  | "accounts"
  | "budgets"
  | "goals"
  | "insights"

export type NavigationItem = {
  title: string
  url: string
  icon: NavigationIcon
}

export const mainNavigationItems: NavigationItem[] = [
  { title: "Tableau de bord", url: "/dashboard", icon: "dashboard" },
  { title: "Transactions", url: "/transactions", icon: "transactions" },
  { title: "Catégories", url: "#", icon: "categories" },
  { title: "Comptes", url: "#", icon: "accounts" },
  { title: "Budgets", url: "#", icon: "budgets" },
  { title: "Objectifs", url: "#", icon: "goals" },
  { title: "Insights", url: "#", icon: "insights" },
]

export function getNavigationItem(pathname: string) {
  return mainNavigationItems.find(
    (item) =>
      item.url !== "#" &&
      (pathname === item.url || pathname.startsWith(`${item.url}/`))
  )
}
