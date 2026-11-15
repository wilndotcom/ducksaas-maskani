'use client'

import { useEffect } from 'react'

const NIGHT_START = 19 // 7pm
const NIGHT_END = 6 // 6am

/** Resolves whether dark mode should be active for the stored preference. */
function resolveDark(osDark: boolean): boolean {
  let t: string | null = null
  try { t = localStorage.getItem('theme') } catch { return osDark }
  if (t === 'dark') return true
  if (t === 'light') return false
  if (t === 'auto') {
    const h = new Date().getHours()
    return osDark || h >= NIGHT_START || h < NIGHT_END
  }
  return osDark // 'system' or unset
}

function apply() {
  try {
    document.documentElement.classList.toggle('dark', resolveDark(window.matchMedia('(prefers-color-scheme: dark)').matches))
  } catch {}
}

/**
 * Keeps the UI theme in sync instantly: OS color-scheme changes, the
 * auto night window (checked every minute), and tab visibility.
 */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    const interval = window.setInterval(apply, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') apply() }
    document.addEventListener('visibilitychange', onVisible)
    apply()
    return () => {
      mq.removeEventListener('change', apply)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
