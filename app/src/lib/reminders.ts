import { minutesOfDay } from './sleep'

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

function stamp(d: Date, time?: string): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return time ? `${date}T${time.replace(':', '')}00` : date
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** `weekdays` (0 = Sunday) makes the event weekly on those days; without it the event repeats daily. */
function event(uid: string, time: string, title: string, body: string, url: string, now: Date, weekdays?: number[]): string[] {
  const [h, m] = time.split(':').map(Number)
  const endMin = h * 60 + m + 10
  // An event that would cross midnight is clamped to 23:59 so start and end stay on one day
  const end = endMin >= 24 * 60 ? '23:59' : hhmm(endMin)
  // A weekly event has to start on one of its own days, or calendars add a stray first occurrence
  const start = new Date(now)
  if (weekdays?.length) while (!weekdays.includes(start.getDay())) start.setDate(start.getDate() + 1)
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@lucid-dream-journal`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    // No time zone on purpose: "floating" times ring at this hour wherever the phone is
    `DTSTART:${stamp(start, time)}`,
    `DTEND:${stamp(start, end)}`,
    weekdays?.length ? `RRULE:FREQ=WEEKLY;BYDAY=${weekdays.map((d) => BYDAY[d]).join(',')}` : 'RRULE:FREQ=DAILY',
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

/**
 * Times for reality-check nudges, spread over the waking day and kept 90 minutes clear of waking and bed.
 * Off the hour on purpose, so they don't blend in with meetings.
 */
export function nudgeTimes(wakeTime: string, bedTime: string, count: number): string[] {
  if (count <= 0) return []
  const start = minutesOfDay(wakeTime) + 90
  let end = minutesOfDay(bedTime) - 90
  if (end <= start) end += 24 * 60
  const span = end - start
  return Array.from({ length: count }, (_, i) => hhmm(Math.round(start + (span * (i + 0.5)) / count + 7) % (24 * 60)))
}

export interface ReminderOptions {
  wakeTime: string
  bedTime: string
  /** Reality-check nudges per day. */
  rcNudges?: number
  /** Wake Back To Bed alert on the mornings after practice evenings. */
  wbtb?: { time: string; weekdays: number[] } | null
}

/** Daily events with alerts: write on waking, set an intention at night, plus optional reality-check nudges and a WBTB alert. */
export function remindersIcs({ wakeTime, bedTime, rcNudges = 0, wbtb }: ReminderOptions, origin: string, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucid//Dream Journal//EN',
    'CALSCALE:GREGORIAN',
    ...event('lucid-morning', wakeTime, 'Write your dream', 'Stay still a moment\\, then write down whatever you remember.', `${origin}/capture`, now),
    ...event('lucid-night', bedTime, 'Set tonight’s intention', 'One line to hold as you fall asleep.', `${origin}/`, now),
    ...nudgeTimes(wakeTime, bedTime, rcNudges).flatMap((time, i) =>
      event(`lucid-rc-${i + 1}`, time, 'Reality check', 'Stop. Is this a dream? Pinch your nose and try to breathe\\, and mean the question.', `${origin}/practice`, now),
    ),
    ...(wbtb?.weekdays.length
      ? event('lucid-wbtb', wbtb.time, 'Wake Back To Bed', 'Sit up\\, open the night session\\, rehearse\\, then back to sleep.', `${origin}/night`, now, wbtb.weekdays)
      : []),
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadReminders(options: ReminderOptions) {
  const blob = new Blob([remindersIcs(options, window.location.origin)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lucid-reminders.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
