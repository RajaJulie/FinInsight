const financeEvent = "fininsight:finance-changed"
const financeChannel = "fininsight-finance"
let sharedChannel: BroadcastChannel | null = null
let subscribers = 0

function getChannel() {
  if (typeof BroadcastChannel === "undefined") return null
  sharedChannel ??= new BroadcastChannel(financeChannel)
  return sharedChannel
}

export function notifyFinanceChanged(local = true) {
  if (local) window.dispatchEvent(new Event(financeEvent))
  const channel = getChannel()
  channel?.postMessage("changed")
  if (subscribers === 0) {
    channel?.close()
    sharedChannel = null
  }
}

export function subscribeFinanceChanges(refresh: () => void) {
  const refreshVisible = () => { if (document.visibilityState === "visible") refresh() }
  const channel = getChannel()
  subscribers += 1
  channel?.addEventListener("message", refreshVisible)
  window.addEventListener(financeEvent, refreshVisible)
  window.addEventListener("focus", refreshVisible)
  document.addEventListener("visibilitychange", refreshVisible)
  // Also pick up writes made outside this tab (API clients, imports, another page).
  const interval = window.setInterval(refreshVisible, 30_000)
  return () => {
    window.clearInterval(interval)
    channel?.removeEventListener("message", refreshVisible)
    subscribers -= 1
    if (subscribers === 0) {
      channel?.close()
      sharedChannel = null
    }
    window.removeEventListener(financeEvent, refreshVisible)
    window.removeEventListener("focus", refreshVisible)
    document.removeEventListener("visibilitychange", refreshVisible)
  }
}
