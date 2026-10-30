import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { loadTs } from "../testing/load-ts.mjs"

const { getVisibleActiveTransaction } = loadTs("lib/transactions/active-row.ts")
const rows = [{ id: "a", top: 80, bottom: 160 }, { id: "b", top: 160, bottom: 240 }, { id: "c", top: 240, bottom: 320 }]

describe("visible transaction tracking", () => {
  it("selects the first row visible below the sticky panel", () => {
    assert.equal(getVisibleActiveTransaction(rows, 100, 600), "a")
    assert.equal(getVisibleActiveTransaction(rows, 160, 600), "b")
    assert.equal(getVisibleActiveTransaction(rows, 240, 600), "c")
  })
  it("tracks both scroll directions without interpreting date or sort order", () => {
    for (const [top, id] of [[100, "a"], [200, "b"], [280, "c"], [200, "b"], [100, "a"]]) {
      assert.equal(getVisibleActiveTransaction(rows, top, 600), id)
    }
    assert.equal(getVisibleActiveTransaction([...rows].reverse(), 100, 600), "a")
  })
  it("does not select rows hidden behind the panel, below the viewport, or with zero height", () => {
    assert.equal(getVisibleActiveTransaction(rows, 160, 220), "b")
    assert.equal(getVisibleActiveTransaction([{ id: "hidden", top: 50, bottom: 50 }, { id: "below", top: 700, bottom: 800 }], 100, 600), null)
    assert.equal(getVisibleActiveTransaction(rows, 330, 600), null)
    assert.equal(getVisibleActiveTransaction(rows, 155, 600), "b")
  })
  it("selects the last visible transaction at the end of the page", () => {
    assert.equal(getVisibleActiveTransaction(rows, 100, 600, true), "c")
    assert.equal(getVisibleActiveTransaction(rows, 100, 220, true), "b")
  })
  it("honors keyboard focus only while the corresponding row remains visible", () => {
    assert.equal(getVisibleActiveTransaction(rows, 100, 600, false, "c"), "c")
    assert.equal(getVisibleActiveTransaction(rows, 200, 600, false, "a"), "b")
    assert.equal(getVisibleActiveTransaction(rows, 100, 220, false, "c"), "a")
  })
  it("handles empty and filtered lists without inventing an active transaction", () => {
    assert.equal(getVisibleActiveTransaction([], 100, 600), null)
    assert.equal(getVisibleActiveTransaction(rows.filter(row => row.id === "b"), 100, 600), "b")
  })
})
