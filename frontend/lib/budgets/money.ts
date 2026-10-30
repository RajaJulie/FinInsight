export function toCents(amount: unknown) {
  return Math.round(Number(amount) * 100)
}

export function sumMoney(amounts: unknown[]) {
  return amounts.reduce<number>((total, amount) => total + toCents(amount), 0) / 100
}

export function getEnvelopeRemaining(amount: number, spent: number) {
  return (toCents(amount) - toCents(spent)) / 100
}
