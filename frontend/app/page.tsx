/**
 * Redirige la racine du site vers le dashboard.
 * La protection de la destination est assuree par la page du dashboard.
 */
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
