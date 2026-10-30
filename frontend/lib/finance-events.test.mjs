import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { it } from "node:test"
import ts from "typescript"

const source = ts.transpileModule(readFileSync(new URL("./finance-events.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
new Function("exports", source)(exports)

it("refreshes after changes, focus, visibility and polling, and cleans up subscriptions", () => {
  const previous = { window: globalThis.window, document: globalThis.document, BroadcastChannel: globalThis.BroadcastChannel }
  const timers = new Map()
  const channels = []
  const windowMock = new EventTarget()
  windowMock.setInterval = (callback, duration) => { assert.equal(duration, 30000); timers.set(1, callback); return 1 }
  windowMock.clearInterval = id => timers.delete(id)
  const documentMock = new EventTarget()
  documentMock.visibilityState = "visible"
  class Channel extends EventTarget {
    constructor(name) { super(); this.name = name; channels.push(this) }
    postMessage(data) { for (const channel of channels) if (channel !== this && !channel.closed && channel.name === this.name) channel.dispatchEvent(new MessageEvent("message", { data })) }
    close() { this.closed = true }
  }
  Object.assign(globalThis, { window: windowMock, document: documentMock, BroadcastChannel: Channel })
  try {
    let refreshes = 0
    const unsubscribe = exports.subscribeFinanceChanges(() => refreshes++)
    exports.notifyFinanceChanged(false)
    assert.equal(refreshes, 0)
    exports.notifyFinanceChanged()
    assert.equal(refreshes, 1)
    const otherTab = new Channel("fininsight-finance")
    otherTab.postMessage("changed")
    otherTab.close()
    assert.equal(refreshes, 2)
    windowMock.dispatchEvent(new Event("focus"))
    timers.get(1)()
    assert.equal(refreshes, 4)
    documentMock.visibilityState = "hidden"
    timers.get(1)()
    assert.equal(refreshes, 4)
    documentMock.visibilityState = "visible"
    documentMock.dispatchEvent(new Event("visibilitychange"))
    assert.equal(refreshes, 5)
    unsubscribe()
    assert.equal(timers.size, 0)
    assert.ok(channels.every(channel => channel.closed))
    windowMock.dispatchEvent(new Event("focus"))
    exports.notifyFinanceChanged()
    assert.equal(refreshes, 5)
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name]
      else globalThis[name] = value
    }
  }
})
