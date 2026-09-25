import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribeToMobileBreakpoint(callback: () => void) {
  const mediaQuery = window.matchMedia(
    `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
  )
  const handleChange = () => callback()

  mediaQuery.addEventListener("change", handleChange)

  return () => mediaQuery.removeEventListener("change", handleChange)
}

function getMobileSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

function getServerMobileSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileBreakpoint,
    getMobileSnapshot,
    getServerMobileSnapshot
  )
}
