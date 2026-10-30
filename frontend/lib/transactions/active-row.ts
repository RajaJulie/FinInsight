export type TransactionRowPosition = { id: string; top: number; bottom: number }

export function getVisibleActiveTransaction(
  rows: TransactionRowPosition[],
  top: number,
  bottom: number,
  atPageEnd = false,
  focusedId: string | null = null
) {
  const visible = rows.filter(row => {
    const height = row.bottom - row.top
    const exposed = Math.min(row.bottom, bottom) - Math.max(row.top, top)
    return height > 0 && exposed >= Math.min(24, height / 2)
  })
    .sort((first, second) => first.top - second.top)
  if (focusedId && visible.some(row => row.id === focusedId)) return focusedId
  return (atPageEnd ? visible.at(-1) : visible[0])?.id ?? null
}
