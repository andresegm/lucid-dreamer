import { useEffect, useState } from 'react'

/** Tracks the on-screen keyboard via visualViewport and exposes it as CSS --keyboard-inset. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport

    const update = () => {
      const keyboard = vv
        ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
        : 0
      setInset(keyboard)
      root.style.setProperty('--keyboard-inset', `${keyboard}px`)
      root.style.setProperty('--vv-height', `${Math.round(vv?.height ?? window.innerHeight)}px`)
      root.style.setProperty('--vv-offset-top', `${Math.round(vv?.offsetTop ?? 0)}px`)
      if (keyboard > 60) root.dataset.keyboardOpen = '1'
      else delete root.dataset.keyboardOpen
    }

    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      root.style.removeProperty('--keyboard-inset')
      root.style.removeProperty('--vv-height')
      root.style.removeProperty('--vv-offset-top')
      delete root.dataset.keyboardOpen
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
