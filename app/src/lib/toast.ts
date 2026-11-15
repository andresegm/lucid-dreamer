export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void | Promise<void> }
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<(list: Toast[]) => void>()

function publish() {
  for (const l of listeners) l(toasts)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  publish()
}

/** A short notice at the top of the screen. With an action (Undo) it stays a little longer. */
export function showToast(text: string, action?: Toast['action'], ms = action ? 8000 : 4000): number {
  const id = nextId++
  toasts = [...toasts, { id, text, action }]
  publish()
  window.setTimeout(() => dismissToast(id), ms)
  return id
}

/** Lists listen for this to reload after something changed elsewhere (undo, offline upload). */
export const DREAMS_CHANGED = 'ldj-dreams-changed'

export function announceDreamsChanged() {
  window.dispatchEvent(new Event(DREAMS_CHANGED))
}

export function onDreamsChanged(reload: () => void) {
  window.addEventListener(DREAMS_CHANGED, reload)
  return () => window.removeEventListener(DREAMS_CHANGED, reload)
}

/** "Deleted" notice with an Undo that restores the dreams. */
export function offerUndoDelete(count: number, restore: () => Promise<void>) {
  showToast(count === 1 ? 'Dream deleted.' : `${count} dreams deleted.`, {
    label: 'Undo',
    run: async () => {
      try {
        await restore()
        announceDreamsChanged()
        showToast(count === 1 ? 'Dream restored.' : `${count} dreams restored.`)
      } catch (e) {
        showToast(`Couldn’t restore: ${e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e)}`)
      }
    },
  })
}

export function subscribeToasts(onChange: (list: Toast[]) => void) {
  listeners.add(onChange)
  onChange(toasts)
  return () => { listeners.delete(onChange) }
}
