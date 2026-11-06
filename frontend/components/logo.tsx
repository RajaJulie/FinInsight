/**
 * Affiche le symbole et le libelle historiques SpendSense du composant Logo.
 * Ce composant est uniquement visuel et ne gere pas la navigation.
 */
export function Logo() {
  return (
    <div className="flex items-center gap-2 text-foreground">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M22 7C19 4 13 4 10 7C7 10 8 14 13 16L18 18C22 20 22 25 18 27C14 29 9 27 7 24"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <span className="text-base font-semibold">
        SpendSense
      </span>
    </div>
  )
}
