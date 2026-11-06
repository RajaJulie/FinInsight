/**
 * Teste le lien des cartes de comptes vers leur historique de transactions.
 * Verifie l'utilisation de l'identifiant reel pour plusieurs types et statuts de compte.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const cache = new Map()
function loadComponent(relativePath) {
  const filename = resolve(frontend, relativePath)
  if (cache.has(filename)) return cache.get(filename).exports
  const loaded = { exports: {} }
  cache.set(filename, loaded)
  let code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  // Exercise the private card without mounting the manager or calling any API.
  if (relativePath === "components/accounts/accounts-manager.tsx") code += "\nmodule.exports.TestAccountCard = AccountCard;"
  const externalRequire = createRequire(filename)
  new Function("require", "module", "exports", code)(name => name.startsWith("@/")
    ? loadComponent(`${name.slice(2)}.${name.startsWith("@/components/") ? "tsx" : "ts"}`)
    : externalRequire(name), loaded, loaded.exports)
  return loaded.exports
}
const { TestAccountCard } = loadComponent("components/accounts/accounts-manager.tsx")
const account = {
  id: "owned-account", name: "Compte bancaire", type: "CHECKING", currency: "EUR", status: "ACTIVE",
  icon: "wallet", color: "#8b5cf6", initialBalance: 12.34, currentBalance: 56.78,
  transactionCount: 3, lastActivity: null, isPrimary: false,
}

describe("account transaction navigation links", () => {
  for (const [type, status, id] of [["CHECKING", "ACTIVE", "lcl"], ["CHECKING", "ACTIVE", "revolut"], ["SAVINGS", "ACTIVE", "life"], ["OTHER", "ACTIVE", "future-account"], ["CHECKING", "ARCHIVED", "archived-account"], ["CASH", "ACTIVE", "encoded id/with?symbols&="]]) {
    it(`links the actual ${type}/${status} account ID without hardcoded names`, () => {
      const props = { ...account, id, type, status }
      const before = JSON.stringify(props)
      const fail = () => { throw new Error("Unexpected financial action") }
      const html = renderToStaticMarkup(createElement(TestAccountCard, { account: props, onEdit: fail, onArchive: fail, onDelete: fail }))
      const link = html.match(/<a[^>]*href="([^"]+)"[^>]*>/)?.[1]
      assert.ok(link)
      const url = new URL(link, "https://isolated.invalid")
      assert.equal(url.pathname, "/transactions")
      assert.equal(url.searchParams.get("accountId"), id)
      assert.equal([...url.searchParams].length, 1)
      assert.ok(html.includes("Voir les transactions"))
      assert.ok(html.includes("Voir les transactions de Compte bancaire"))
      assert.equal(JSON.stringify(props), before)
    })
  }
})
