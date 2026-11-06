/**
 * Expose les handlers GET et POST d'Auth.js sous le chemin d'authentification.
 * La configuration des sessions et des identifiants reste centralisee dans auth.ts.
 */
import { handlers } from "@/auth" // Referring to the auth.ts we just created
export const { GET, POST } = handlers
