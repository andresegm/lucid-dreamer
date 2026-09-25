import { differenceInCalendarDays, parseISO } from 'date-fns'

export const RECALL_TIP_GROUPS: { id: string; title: string; blurb: string; items: string[] }[] = [
  {
    id: 'tonight',
    title: 'Tonight',
    blurb: 'Protect the last hours of REM and set the intention before you drop off.',
    items: [
      'Get 7.5–9 hours of sleep and avoid cutting the final 1–2 hours short.',
      'Keep a consistent sleep/wake schedule to stabilize REM.',
      'Set a pre-sleep intention: “When I wake up, I will remember my dreams.”',
      'Visualize yourself waking up and recalling a dream for 30–60 seconds before sleep.',
      'Avoid alcohol near bedtime, which can disrupt later-night REM.',
      'Give yourself a few alarm-free mornings when your schedule permits.',
    ],
  },
  {
    id: 'waking',
    title: 'On waking',
    blurb: 'The first minute decides whether the dream stays.',
    items: [
      'When waking, stay completely still and keep your eyes closed.',
      'Search backward for the dream from your last emotion, image, thought, or sensation.',
      "Don't check your phone immediately after waking.",
      'Journal even tiny fragments—one image, person, location, or emotion counts.',
    ],
  },
  {
    id: 'practice',
    title: 'Practice',
    blurb: 'Recall first. Lucidity comes back faster when the nights are written down.',
    items: [
      'Use WBTB 1–3×/week: wake after ~5–6 hours, stay up 10–20 minutes, then return to sleep.',
      'During WBTB, think about dreaming rather than consuming stimulating content.',
      'Practice sensory awareness during the day—deliberately notice sights, sounds, touch, smell, and body sensations.',
      'Do occasional reality checks with genuine curiosity rather than mechanically.',
      "Don't chase lucidity every night—prioritize rebuilding dream recall first.",
    ],
  },
]

export interface RecallContext {
  todayCount: number
  lastDate: string | null
  recentCount: number
  recentLucid: number
}

const MORNING_LINES = [
  'Stay still with your eyes closed and search backward from the last feeling.',
  "Don't check your phone yet — dump even one image first.",
  'One image, person, location, or emotion is enough to write down.',
]

/** One line for the Dreams banner when there is no entry today. */
export function pickMorningLine(ctx: RecallContext, today = new Date()): string | null {
  if (ctx.todayCount > 0) return null
  const daysSince = ctx.lastDate ? differenceInCalendarDays(today, parseISO(ctx.lastDate)) : 99
  if (daysSince >= 2) return 'Stay still, skip the phone, write even one image.'
  if (ctx.recentCount >= 10 && ctx.recentLucid / ctx.recentCount < 0.15) {
    return "Don't chase lucidity every night — rebuild recall first."
  }
  return MORNING_LINES[today.getDate() % MORNING_LINES.length]
}
