import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getRecurringStatusActionLabel,
  getRecurringStatusErrorMessage,
  getRecurringStatusLabel,
  getRecurringStatusPatchPayload,
  replaceRecurringTransactionById,
} from "./status.ts"

describe("recurring status helpers", () => {
  it("builds the inactive patch payload", () => {
    assert.deepEqual(getRecurringStatusPatchPayload(false), { active: false })
    assert.equal(getRecurringStatusLabel(false), "Inactif")
    assert.equal(getRecurringStatusActionLabel(false), "Réactiver")
  })

  it("builds the active patch payload", () => {
    assert.deepEqual(getRecurringStatusPatchPayload(true), { active: true })
    assert.equal(getRecurringStatusLabel(true), "Actif")
    assert.equal(getRecurringStatusActionLabel(true), "Désactiver")
  })

  it("updates the same recurring transaction without creating a duplicate", () => {
    const items = [
      { id: "adobe", active: true, title: "Adobe" },
      { id: "chatgpt", active: true, title: "ChatGPT" },
    ]
    const updatedItems = replaceRecurringTransactionById(items, {
      id: "adobe",
      active: false,
      title: "Adobe",
    })

    assert.equal(updatedItems.length, 2)
    assert.deepEqual(updatedItems, [
      { id: "adobe", active: false, title: "Adobe" },
      { id: "chatgpt", active: true, title: "ChatGPT" },
    ])
  })

  it("does not alter unrelated items such as Apple B when Apple A changes", () => {
    const items = [
      { id: "apple-a", active: true, title: "iCloud Apple" },
      { id: "apple-b", active: true, title: "Gmail Apple" },
    ]
    const updatedItems = replaceRecurringTransactionById(items, {
      id: "apple-a",
      active: false,
      title: "iCloud Apple",
    })

    assert.equal(updatedItems.find((item) => item.id === "apple-a")?.active, false)
    assert.equal(updatedItems.find((item) => item.id === "apple-b")?.active, true)
  })

  it("formats patch errors", () => {
    assert.equal(
      getRecurringStatusErrorMessage(404, undefined),
      "Cette charge récurrente est introuvable."
    )
    assert.equal(
      getRecurringStatusErrorMessage(401, undefined),
      "Vous devez être connecté pour modifier cette charge."
    )
    assert.equal(
      getRecurringStatusErrorMessage(500, "Erreur serveur."),
      "Erreur serveur."
    )
  })
})
