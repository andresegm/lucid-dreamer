import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

/** URLs can carry dream search terms (?q=) and Supabase filter values, so keep only the path. */
function stripQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url
  const i = url.search(/[?#]/)
  return i === -1 ? url : url.slice(0, i)
}

/** Postgres errors can echo the failing row, which would include dream text. */
function scrubMessage(msg: string): string {
  return msg.replace(/Failing row contains[\s\S]*/i, 'Failing row contains [redacted]').slice(0, 300)
}

export function initMonitoring() {
  if (!dsn || !import.meta.env.PROD) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console') return null
      if (crumb.data) {
        crumb.data = { ...crumb.data, url: stripQuery(crumb.data.url), from: stripQuery(crumb.data.from), to: stripQuery(crumb.data.to) }
      }
      return crumb
    },
    beforeSend(event) {
      delete event.extra
      delete event.user
      if (event.request) {
        event.request = { url: stripQuery(event.request.url) as string | undefined }
      }
      if (event.message) event.message = scrubMessage(event.message)
      for (const ex of event.exception?.values ?? []) {
        if (ex.value) ex.value = scrubMessage(ex.value)
      }
      return event
    },
  })
}

export const ErrorBoundary = Sentry.ErrorBoundary
