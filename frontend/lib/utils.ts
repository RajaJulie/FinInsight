/**
 * Fournit cn pour composer les classes conditionnelles avec clsx
 * et resoudre leurs conflits Tailwind avec tailwind-merge.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
