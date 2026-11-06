/**
 * Teste la route de lecture des transactions avec des dependances simulees.
 * Verifie l'authentification, l'isolation utilisateur, l'ordre stable et l'absence d'ecriture.
 */
import assert from "node:assert/strict"
import { it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

it("authenticates the transaction history, scopes it to the user and requests a deterministic order without writes", async () => {
  let email = null
  const queries = []
  const { GET } = loadTs("app/api/transactions/route.ts", {
    "@/auth": { auth: async () => email ? { user: { email } } : null },
    "@/lib/prisma": { prisma: {
      user: { findUnique: async ({ where }) => where.email === "owned@example.invalid" ? { id: "owned" } : null },
      transaction: { findMany: async query => { queries.push(query); return [{ id: "t", category: "legacy", categoryRelation: { name: "Loisirs" } }] } },
    } },
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
  })
  assert.equal((await GET()).status, 401)
  email = "foreign@example.invalid"
  assert.equal((await GET()).status, 401)
  assert.equal(queries.length, 0)
  email = "owned@example.invalid"
  const response = await GET()
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json())[0], { id: "t", category: "Loisirs" })
  assert.deepEqual(queries[0].where, { userId: "owned" })
  assert.deepEqual(queries[0].orderBy, [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }])
})
