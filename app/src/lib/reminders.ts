const pad = (n: number) => String(n).padStart(2, '0')

function stamp(d: Date, time?: string): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return time ? `${date}T${time.replace(':', '')}00` : date
}

function event(uid: string, time: string, title: string, body: string, url: string, now: Date): string[] {
  const [h, m] = time.split(':').map(Number)
  const endMin = h * 60 + m + 10
  // An event that would cross midnight is clamped to 23:59 so start and end stay on one day
  const end = endMin >= 24 * 60 ? '23:59' : `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@lucid-dream-journal`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    // No time zone on purpose: "floating" times ring at this hour wherever the phone is
    `DTSTART:${stamp(now, time)}`,
    `DTEND:${stamp(now, end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${title}`,
    `DESCRIPTION:${body}`,
    `URL:${url}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
  ]
}

/** Two daily repeating calendar events with alerts: write on waking, set an intention at night. */
export function remindersIcs(wakeTime: string, bedTime: string, origin: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucid//Dream Journal//EN',
    'CALSCALE:GREGORIAN',
    ...event('lucid-morning', wakeTime, 'Write your dream', 'Stay still a moment\\, then write down whatever you remember.', `${origin}/capture`, now),
    ...event('lucid-night', bedTime, 'Set tonight’s intention', 'One line to hold as you fall asleep.', `${origin}/`, now),
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadReminders(wakeTime: string, bedTime: string) {
  const blob = new Blob([remindersIcs(wakeTime, bedTime, window.location.origin)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lucid-reminders.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
