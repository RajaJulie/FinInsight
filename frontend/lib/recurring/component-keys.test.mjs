import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import ts from "typescript"

const source = ts.createSourceFile(
  "budgets-manager.tsx",
  readFileSync(new URL("../../components/budgets/budgets-manager.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)
const keyExpressions = new Map()

function collectKeys(node) {
  if (ts.isJsxSelfClosingElement(node)) {
    const name = node.tagName.getText(source)
    if (name === "RecurringSuggestions" || name === "RecurringTransactions") {
      const key = node.attributes.properties.find((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "key"
      )
      assert.ok(key && ts.isJsxExpression(key.initializer) && key.initializer.expression)
      const expression = key.initializer.expression.getText(source)
      keyExpressions.set(name, new Function("suggestionsVersion", "recurringVersion", `return ${expression}`))
    }
  }
  ts.forEachChild(node, collectKeys)
}
collectKeys(source)

describe("recurring section sibling keys", () => {
  it("keeps distinct keys when both refresh counters are equal, including zero", () => {
    assert.equal(keyExpressions.size, 2)
    for (const version of [0, 1, 2, 10]) {
      const keys = [...keyExpressions.values()].map((key) => String(key(version, version)))
      assert.equal(new Set(keys).size, 2)
    }
  })

  it("keeps keys stable and refreshes only the intended section", () => {
    const suggestions = keyExpressions.get("RecurringSuggestions")
    const transactions = keyExpressions.get("RecurringTransactions")
    assert.equal(suggestions(0, 0), suggestions(0, 0))
    assert.equal(transactions(0, 0), transactions(0, 0))
    assert.equal(suggestions(0, 0), suggestions(0, 1))
    assert.equal(transactions(0, 0), transactions(1, 0))
    assert.notEqual(suggestions(0, 0), suggestions(1, 0))
    assert.notEqual(transactions(0, 0), transactions(0, 1))
  })
})
