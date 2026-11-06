/**
 * Charge les modules TypeScript dans les tests Node avec compilation en memoire.
 * Permet d'injecter des dependances simulees et de partager un cache de modules.
 */
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

// Load real TypeScript modules while keeping database and authentication isolated.
export function loadTs(path, mocks = {}, cache = new Map()) {
  const filename = resolve(frontend, path)
  if (cache.has(filename)) return cache.get(filename).exports
  const loadedModule = { exports: {} }
  cache.set(filename, loadedModule)
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const externalRequire = createRequire(filename)
  const requireModule = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name === "@/auth" || name === "@/lib/prisma") throw new Error("Missing isolated mock")
    if (name.startsWith("@/")) return loadTs(`${name.slice(2)}.ts`, mocks, cache)
    if (name.startsWith(".")) return loadTs(`${resolve(dirname(filename), name)}.ts`, mocks, cache)
    return externalRequire(name)
  }
  new Function("require", "module", "exports", code)(requireModule, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
