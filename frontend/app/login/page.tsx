/**
 * Affiche la page de connexion en reutilisant le formulaire LoginForm.
 * La verification des identifiants est geree par Auth.js.
 */
"use client"

import { LoginForm } from "@/components/login-form"


export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden bg-muted lg:block">
        
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      
    </div>
  )
}
