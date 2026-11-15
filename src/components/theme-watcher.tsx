'use client'

import { useEffect } from 'react'

/**
 * Keeps the UI in sync with the OS color scheme when the user's theme
 * preference is "system" (or unset). Listens for live OS theme changes
 * so the interface switches automatically without a reload.
 */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      try {
        const t = localStorage.getItem('theme')
        if (!t || t === 'system') {
          document.documentElement.classList.toggle('dark', mq.matches)
        }
      } catch {}
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return null
}
