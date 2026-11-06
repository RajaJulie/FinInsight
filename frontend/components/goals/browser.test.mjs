/** Tests navigateur optionnels : composants reels, API simulees, aucune connexion PostgreSQL. */
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { after, before, describe, it } from "node:test"

// Playwright reste externe et facultatif ; la suite Node habituelle n'ajoute aucune dependance.
const playwrightModule = process.env.FININSIGHT_PLAYWRIGHT_MODULE
describe("goals browser interactions with isolated HTTP mocks", { skip: !playwrightModule }, () => {
  const frontend = fileURLToPath(new URL("../../", import.meta.url))
  const require = createRequire(join(frontend, "package.json"))
  let directory, server, browser, origin, expect
  before(async () => {
    const { chromium } = await import(pathToFileURL(playwrightModule).href)
    directory = await mkdtemp(join(tmpdir(), "fininsight-goals-ui-"))
    const loader = join(directory, "loader.cjs")
    await writeFile(loader, `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,allowJs:true}}).outputText}`)
    const navigation = join(directory, "navigation.mjs"), link = join(directory, "link.mjs"), image = join(directory, "image.mjs")
    await writeFile(navigation, 'export const usePathname=()=>window.location.pathname;')
    await writeFile(link, 'import{createElement}from"react";export default function Link({href,...props}){return createElement("a",{...props,href})}')
    await writeFile(image, 'import{createElement}from"react";export default function Image({priority,fill,...props}){return createElement("img",props)}')
    const entry = join(directory, "entry.mjs")
    await writeFile(entry, `import React from "react";import{createRoot}from"react-dom/client";import{GoalsManager}from"@/components/goals/goals-manager";import{AppSidebar}from"@/components/app-sidebar";import{SiteHeader}from"@/components/site-header";import{SidebarProvider,SidebarInset}from"@/components/ui/sidebar";import{TooltipProvider}from"@/components/ui/tooltip";import{Toaster}from"@/components/ui/sonner";createRoot(document.getElementById("root")).render(React.createElement(TooltipProvider,null,React.createElement(SidebarProvider,{style:{"--sidebar-width":"18rem","--header-height":"3rem"}},React.createElement(AppSidebar,{variant:"inset"}),React.createElement(SidebarInset,{className:"min-w-0 overflow-x-hidden"},React.createElement(SiteHeader,{user:{name:"Utilisateur de test",email:"fixture@example.invalid",avatar:"/logo.png"}}),React.createElement("main",{className:"min-w-0 px-4 py-6 lg:px-8"},React.createElement(GoalsManager)))),React.createElement(Toaster))));`)
    const { webpack } = require("next/dist/compiled/webpack/webpack")
    const compiler = webpack({
      mode: "development", devtool: false, context: frontend, entry, target: "web",
      output: { path: directory, filename: "app.js" },
      resolve: { extensions: [".tsx", ".ts", ".mjs", ".js", ".json"], modules: [join(frontend, "node_modules"), "node_modules"], alias: {
        "@": frontend, react: join(frontend, "node_modules/react"), "react-dom": join(frontend, "node_modules/react-dom"),
        "next/navigation$": navigation, "next/link$": link, "next/image$": image,
      } },
      module: { rules: [{ test: /\.[cm]?[jt]sx?$/, exclude: /node_modules/, use: loader }] },
      plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      infrastructureLogging: { level: "error" },
    })
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      compiler.close(() => {})
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toJson({ all: false, errors: true }).errors.map(item => `${item.message.split("\n")[0]}: ${(item.moduleTrace ?? []).map(trace => trace.originName).join(" -> ")}`).join("\n")))
      else resolve()
    }))
    const globals = join(frontend, "app/globals.css")
    const css = await require("postcss")([require("@tailwindcss/postcss")({ base: frontend })]).process(await readFile(globals, "utf8"), { from: globals })
    await writeFile(join(directory, "style.css"), css.css)
    server = createServer(async (request, response) => {
      const path = new URL(request.url, "http://localhost").pathname
      // Aucun proxy vers les routes reelles : toute API non interceptee est refusee.
      if (request.method !== "GET" || path.startsWith("/api/")) { response.writeHead(405); response.end(); return }
      try {
        if (["/app.js", "/style.css"].includes(path)) {
          response.setHeader("Content-Type", path.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8")
          response.end(await readFile(join(directory, path.slice(1))))
        } else if (/^\/(?:FinInsight[^/]*|logo)\.png$/.test(path)) {
          response.setHeader("Content-Type", "image/png"); response.end(await readFile(join(frontend, "public", path.slice(1))))
        } else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end('<!doctype html><html lang="fr" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>') }
      } catch { response.writeHead(404); response.end() }
    })
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
    origin = `http://127.0.0.1:${server.address().port}`
    browser = await chromium.launch({ headless: true, channel: process.env.FININSIGHT_BROWSER_CHANNEL || undefined })
    // Les assertions Playwright sont remplacees par les attentes de locators disponibles sans @playwright/test.
    expect = async (locator, text) => { await locator.filter({ hasText: text }).first().waitFor() }
  })
  after(async () => {
    try { await browser?.close() } finally {
      try { if (server?.listening) await new Promise(resolve => server.close(resolve)) } finally { if (directory) await rm(directory, { recursive: true, force: true }) }
    }
  })

  function fixture(empty = false) {
    const account = { id: "a", name: "Compte test", type: "CHECKING", currency: "EUR", status: "ACTIVE", bankBalance: 250, balanceVerified: false, hasFutureEntries: false, reservedAmount: 150, unreservedAmount: 100, underfunded: false, shortfallAmount: 0 }
    const make = (id, title, status, accumulatedAmount) => ({ id, title, status, accumulatedAmount, accountId: "a", account, targetAmount: 100, remainingAmount: Math.max(0, 100 - accumulatedAmount), progressPercentage: accumulatedAmount, reached: accumulatedAmount >= 100, excessAmount: Math.max(0, accumulatedAmount - 100), targetDate: null, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", warnings: [], entries: [] })
    return { goals: empty ? [] : [make("g", "Voyage", "ACTIVE", 20), make("p", "Projet en pause", "PAUSED", 5), make("r", "Projet archivé", "ARCHIVED", 125)], account, writes: [], keys: new Map(), fail: null, loseNextEntry: false, reads: 0 }
  }
  async function open(state, viewport = { width: 1365, height: 950 }) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
    context.setDefaultTimeout(10000)
    const page = await context.newPage()
    page.on("pageerror", error => console.error("Isolated goals browser:", error.message))
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname
      const body = request.method() === "GET" ? null : request.postDataJSON()
      const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) })
      if (request.method() === "GET") {
        state.reads++
        if (state.fail?.read) { await reply({ message: "Connexion indisponible" }, 500); return }
        if (path === "/api/goals") await reply({ goals: state.goals, accounts: [state.account], asOf: "2026-11-01T12:00:00Z" })
        else { const goal = state.goals.find(item => path === `/api/goals/${item.id}`); await reply(goal ? { goal } : { message: "Introuvable" }, goal ? 200 : 404) }
        return
      }
      assert.match(path, /^\/api\/goals(?:\/[^/]+(?:\/entries)?)?$/)
      state.writes.push({ path, body, method: request.method() })
      await new Promise(resolve => setTimeout(resolve, 80))
      if (state.fail) { const failure = state.fail; state.fail = null; await reply(failure.body ?? { message: failure.message ?? "Conflit financier", code: failure.code }, failure.status); return }
      if (path === "/api/goals") {
        const goal = { ...state.goals[0], ...body, id: `new-${state.writes.length}`, status: "ACTIVE", accumulatedAmount: 0, remainingAmount: body.targetAmount, progressPercentage: 0, reached: false, entries: [], account: state.account }
        state.goals.push(goal); await reply({ message: "Objectif créé avec succès.", goal }, 201); return
      }
      const goal = state.goals.find(item => path.startsWith(`/api/goals/${item.id}`))
      if (request.method() === "PATCH") { Object.assign(goal, body); await reply({ message: "Objectif modifié avec succès.", goal }); return }
      if (state.keys.has(body.idempotencyKey)) { await reply({ message: "Opération déjà enregistrée.", replayed: true, goal, entry: state.keys.get(body.idempotencyKey) }); return }
      const entry = { id: `entry-${state.keys.size}`, ...body, effectiveAt: "2026-11-01T12:00:00Z", createdAt: "2026-11-01T12:00:00Z" }
      state.keys.set(body.idempotencyKey, entry); goal.entries.push(entry)
      const cents = Math.round(goal.accumulatedAmount * 100) + (body.type === "ALLOCATION" ? 1 : -1) * Math.round(body.amount * 100)
      goal.accumulatedAmount = cents / 100; goal.remainingAmount = (Math.round(goal.targetAmount * 100) - cents) / 100; goal.progressPercentage = goal.accumulatedAmount / goal.targetAmount * 100
      state.account.reservedAmount += (body.type === "ALLOCATION" ? 1 : -1) * body.amount
      state.account.unreservedAmount = Math.round((state.account.bankBalance - state.account.reservedAmount) * 100) / 100
      if (state.loseNextEntry) { state.loseNextEntry = false; await route.abort("connectionfailed"); return }
      await reply({ message: "Mouvement virtuel enregistré.", replayed: false, goal, entry }, 201)
    })
    await page.goto(`${origin}/goals`)
    return { page, context }
  }
  const dialog = page => page.getByRole("dialog")
  async function settle(page) { await page.getByRole("button", { name: "Actualiser les objectifs", exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('button[aria-label="Actualiser les objectifs"]')?.disabled) }

  it("creates, edits, validates movements, preserves keys, refreshes and renders details", async () => {
    const state = fixture(), { page, context } = await open(state)
    try {
      await settle(page)
      await page.getByRole("button", { name: "Nouvel objectif", exact: true }).click()
      await expect(dialog(page), "Choisir un compte")
      await page.getByLabel("Titre", { exact: true }).fill("Permis")
      await page.getByLabel("Montant cible (€)", { exact: true }).fill("100,29")
      await page.getByRole("combobox", { name: "Compte associé" }).click()
      await page.getByRole("option", { name: "Compte test", exact: true }).click()
      try { await page.getByRole("button", { name: "Créer l'objectif", exact: true }).click() }
      catch (error) { console.error("Create dialog snapshot:", await page.locator("body").innerText()); throw error }
      await dialog(page).waitFor({ state: "hidden" }); await settle(page)
      assert.equal(state.writes[0].body.targetAmount, 100.29)
      assert.deepEqual(Object.keys(state.writes[0].body).sort(), ["accountId", "targetAmount", "targetDate", "title"])
      await page.getByRole("button", { name: "Modifier Voyage", exact: true }).click()
      await page.getByLabel("Titre", { exact: true }).fill("Voyage au Japon")
      await page.getByRole("button", { name: "Enregistrer", exact: true }).click()
      await dialog(page).waitFor({ state: "hidden" }); await settle(page)
      assert.equal(state.writes[1].body.title, "Voyage au Japon"); assert.equal("accountId" in state.writes[1].body, false)
      await page.getByRole("button", { name: "Affecter à Voyage au Japon", exact: true }).click()
      await page.getByLabel("Montant (€)", { exact: true }).fill("10,29")
      await page.getByLabel("Note (facultative)", { exact: true }).fill("Versement virtuel test")
      await page.getByRole("button", { name: "Confirmer l'affectation", exact: true }).evaluate(button => { button.click(); button.click() })
      await dialog(page).waitFor({ state: "hidden" }); await settle(page)
      assert.equal(state.writes.length, 3); assert.equal(state.goals[0].accumulatedAmount, 30.29)
      await page.getByRole("button", { name: "Libérer de Voyage au Japon", exact: true }).click()
      await page.getByLabel("Montant (€)", { exact: true }).fill("99")
      await page.getByRole("button", { name: "Confirmer la libération", exact: true }).click()
      await expect(dialog(page).getByRole("alert"), "libérable"); assert.equal(state.writes.length, 3)
      await page.getByLabel("Montant (€)", { exact: true }).fill("5")
      await page.getByRole("button", { name: "Confirmer la libération", exact: true }).click()
      await dialog(page).waitFor({ state: "hidden" }); await settle(page)
      assert.equal(state.goals[0].accumulatedAmount, 25.29)
      await page.getByRole("button", { name: "Affecter à Voyage au Japon", exact: true }).click()
      await page.getByLabel("Montant (€)", { exact: true }).fill("10,29")
      state.fail = { status: 400, body: { errors: { fieldErrors: { amount: ["Montant invalide côté serveur"] } } } }
      await page.getByRole("button", { name: "Confirmer l'affectation", exact: true }).click()
      await expect(dialog(page).getByRole("alert"), "Montant invalide")
      assert.equal(await page.getByLabel("Montant (€)", { exact: true }).inputValue(), "10,29")
      const beforeConflict = state.reads
      state.fail = { status: 409, code: "INSUFFICIENT_UNRESERVED_FUNDS", message: "Fonds insuffisants" }
      await page.getByRole("button", { name: "Confirmer l'affectation", exact: true }).click()
      await expect(dialog(page).getByRole("alert"), "Fonds insuffisants"); await settle(page)
      assert.ok(state.reads > beforeConflict)
      state.fail = { status: 404, message: "Suggestion inexistante" }
      await page.getByRole("button", { name: "Confirmer l'affectation", exact: true }).click()
      await expect(dialog(page).getByRole("alert"), "inexistante"); await settle(page)
      state.loseNextEntry = true
      await page.getByRole("button", { name: "Confirmer l'affectation", exact: true }).click()
      await page.getByRole("button", { name: "Réessayer la même opération", exact: true }).waitFor()
      assert.equal(await page.getByLabel("Montant (€)", { exact: true }).isDisabled(), true)
      const lostKey = state.writes.at(-1).body.idempotencyKey, beforeReplay = state.goals[0].accumulatedAmount
      await page.getByRole("button", { name: "Réessayer la même opération", exact: true }).click()
      await dialog(page).waitFor({ state: "hidden" }); await settle(page)
      assert.equal(state.writes.at(-1).body.idempotencyKey, lostKey); assert.equal(state.goals[0].accumulatedAmount, beforeReplay)
      await page.getByRole("button", { name: "Détails de Voyage au Japon", exact: true }).click()
      await expect(dialog(page), "Versement virtuel test")
      assert.ok(await dialog(page).getByText("Libération", { exact: true }).count())
      await page.keyboard.press("Escape")
      const writes = state.writes.length
      await page.getByRole("button", { name: "Affecter à Voyage au Japon", exact: true }).click()
      await page.getByRole("button", { name: "Annuler", exact: true }).click()
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Affecter à Voyage au Japon")
      assert.equal(state.writes.length, writes)
      assert.equal(state.account.bankBalance, 250)
      await page.screenshot({ path: join(tmpdir(), "fininsight-goals-desktop.png"), fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    } finally { await context.close() }
  })

  it("filters statuses, offers legal archived transitions and supports mobile navigation", async () => {
    const state = fixture(), { page, context } = await open(state, { width: 390, height: 844 })
    try {
      await settle(page)
      await page.getByRole("combobox", { name: "Statut", exact: true }).click()
      try { await page.getByRole("option", { name: "Archivé", exact: true }).click() }
      catch (error) { console.error("Status filter snapshot:", await page.locator("body").innerText()); throw error }
      await page.getByRole("button", { name: "Modifier Projet archivé", exact: true }).click()
      await page.getByRole("combobox", { name: "Statut", exact: true }).last().click()
      assert.equal(await page.getByRole("option", { name: "En pause", exact: true }).count(), 0)
      await page.keyboard.press("Escape"); await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click()
      const link = page.getByRole("link", { name: "Objectifs", exact: true })
      assert.equal(await link.getAttribute("href"), "/goals")
      assert.equal(await link.getAttribute("aria-current"), "page")
      await link.click(); await settle(page)
      await page.screenshot({ path: join(tmpdir(), "fininsight-goals-mobile.png"), fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
      assert.equal(state.writes.length, 0)
    } finally { await context.close() }
  })

  it("shows explicit empty and read-error states without write requests", async () => {
    const state = fixture(true), { page, context } = await open(state)
    try {
      await page.getByRole("heading", { name: "Votre prochain projet commence ici" }).waitFor()
      state.fail = { read: true }
      await page.getByRole("button", { name: "Actualiser les objectifs", exact: true }).click()
      await expect(page.getByRole("alert"), "Connexion indisponible")
      assert.equal(state.writes.length, 0)
    } finally { await context.close() }
  })
})
