import { useEffect, useState } from 'react'

type Listener = (inset: number) => void

let subscribers = 0
const listeners = new Set<Listener>()
let currentInset = 0
let removeViewportListeners: (() => void) | null = null

function readKeyboardInset() {
  const vv = window.visualViewport
  return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
}

function publish() {
  const root = document.documentElement
  const vv = window.visualViewport
  const keyboard = readKeyboardInset()
  currentInset = keyboard
  root.style.setProperty('--keyboard-inset', `${keyboard}px`)
  root.style.setProperty('--vv-height', `${Math.round(vv?.height ?? window.innerHeight)}px`)
  root.style.setProperty('--vv-offset-top', `${Math.round(vv?.offsetTop ?? 0)}px`)
  if (keyboard > 60) root.dataset.keyboardOpen = '1'
  else delete root.dataset.keyboardOpen
  for (const listener of listeners) listener(keyboard)
}

function startViewportTracking() {
  if (removeViewportListeners) return
  const vv = window.visualViewport
  const update = () => publish()
  update()
  vv?.addEventListener('resize', update)
  vv?.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  removeViewportListeners = () => {
    vv?.removeEventListener('resize', update)
    vv?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    removeViewportListeners = null
  }
}

function stopViewportTracking() {
  removeViewportListeners?.()
  const root = document.documentElement
  root.style.removeProperty('--keyboard-inset')
  root.style.removeProperty('--vv-height')
  root.style.removeProperty('--vv-offset-top')
  delete root.dataset.keyboardOpen
  currentInset = 0
}

/** Tracks the on-screen keyboard via visualViewport and exposes it as CSS --keyboard-inset. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(currentInset)

  useEffect(() => {
    const listener: Listener = (next) => setInset(next)
    listeners.add(listener)
    subscribers += 1
    if (subscribers === 1) startViewportTracking()
    else setInset(currentInset)

    return () => {
      listeners.delete(listener)
      subscribers -= 1
      if (subscribers === 0) stopViewportTracking()
    }
  }, [])

  return inset
}

type KeepOpts = {
  /** When false, only scroll inside the textarea — never nudge the page. */
  pageScroll?: boolean
}

/** Keep the caret / bottom of a focused textarea above the keyboard. */
export function keepTextareaAboveKeyboard(el: HTMLTextAreaElement, opts: KeepOpts = {}) {
  const { pageScroll = true } = opts

  const run = () => {
    // Prefer scrolling inside the textarea when the caret is at the end.
    if (el.selectionStart === el.value.length) {
      el.scrollTop = el.scrollHeight
    }

    if (!pageScroll) return

    const vv = window.visualViewport
    if (!vv) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 16
    const visibleBottom = vv.offsetTop + vv.height

    // Already fully clear of the keyboard — nothing to do (avoids jumpiness).
    if (rect.bottom <= visibleBottom - pad) return

    // Aim to keep the lower portion of the field (where new lines appear) in view.
    const target = Math.min(rect.bottom, rect.top + Math.min(el.clientHeight, 120))
    if (target > visibleBottom - pad) {
      window.scrollBy({ top: target - (visibleBottom - pad), behavior: 'auto' })
    }
  }

  requestAnimationFrame(() => requestAnimationFrame(run))
}
