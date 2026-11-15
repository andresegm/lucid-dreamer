const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Marks every occurrence of the search words inside `text`. */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  const words = (terms ?? []).filter(Boolean)
  if (!words.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${words.map(escapeRe).join('|')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm px-0.5" style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--text)' }}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
