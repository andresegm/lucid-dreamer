import { INDUCTION_DESCRIPTIONS, INDUCTION_METHODS, type InductionMethod } from './types'

export type LearnSectionId = 'basics' | 'sleep' | 'recall' | 'journaling' | 'methods'

export const LEARN_SECTIONS: { id: LearnSectionId; label: string; title: string; blurb: string }[] = [
  {
    id: 'basics',
    label: 'Basics',
    title: 'What is lucid dreaming?',
    blurb: 'Knowing you are dreaming while the dream is still happening.',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    title: 'Stages of sleep',
    blurb: 'Lucidity almost always shows up in REM — the part of the night dreams thrive in.',
  },
  {
    id: 'recall',
    label: 'Recall',
    title: 'Dream recall basics',
    blurb: 'If the night vanishes by morning, lucidity has nowhere to land.',
  },
  {
    id: 'journaling',
    label: 'Journaling',
    title: 'Why journaling matters',
    blurb: 'Writing is how fragments become memory — and how patterns become visible.',
  },
  {
    id: 'methods',
    label: 'Methods',
    title: 'Induction methods',
    blurb: 'The same categories you can tag on a lucid entry in Lucid.',
  },
]

export const LUCID_BASICS = {
  lead: 'A lucid dream is a dream in which you realize you are dreaming — while still inside it. That moment of recognition can be brief or last for minutes. Sometimes you only notice; sometimes you can steer the scene.',
  points: [
    {
      title: 'Awareness, not control',
      body: 'Lucidity starts with noticing. Control is optional and often comes later. Semi-lucid dreams — where something feels off but you don’t fully conclude “this is a dream” — still count as progress.',
    },
    {
      title: 'It happens in REM',
      body: 'Most vivid dreaming occurs in rapid-eye-movement sleep. Longer REM periods later in the night are why morning dreams feel richer — and why many induction techniques aim at those hours.',
    },
    {
      title: 'Recall first',
      body: 'You cannot train what you never remember. Stable dream recall is the foundation; lucidity rates rise after nights are written down consistently.',
    },
    {
      title: 'Gentle practice',
      body: 'Sleep quality matters more than forcing techniques. Prefer a few well-rested attempts over chasing lucidity every night at the cost of sleep.',
    },
  ],
}

export const SLEEP_STAGES: {
  id: string
  name: string
  short: string
  body: string
  lucid?: boolean
}[] = [
  {
    id: 'n1',
    name: 'N1 — light sleep',
    short: 'Falling asleep',
    body: 'The bridge from wakefulness. Thoughts loosen, muscles ease, and brief imagery can appear. Easy to wake from; not where long dreams usually live.',
  },
  {
    id: 'n2',
    name: 'N2 — light / consolidated',
    short: 'Most of the night',
    body: 'A large share of total sleep. Memory and body recovery continue. You can dream here, but scenes are often thinner than in REM.',
  },
  {
    id: 'n3',
    name: 'N3 — deep sleep',
    short: 'Slow-wave',
    body: 'Hardest to wake from. Critical for physical recovery and feeling rested. Dream reports from deep sleep are rare and usually sparse.',
  },
  {
    id: 'rem',
    name: 'REM — dreaming sleep',
    short: 'Where lucidity lives',
    lucid: true,
    body: 'Eyes move, the brain is highly active, and vivid narrative dreams are common. REM cycles lengthen toward morning — the best window for recall and many induction methods.',
  },
]

export const SLEEP_CYCLE_NOTE =
  'A full night cycles through these stages several times. Early cycles favor deep sleep; later cycles favor longer REM. Protecting the final hours of sleep protects the dreams you are most likely to remember.'

export const RECALL_BASICS = {
  lead: 'Dream recall is the skill of retrieving what happened overnight before waking life overwrites it. It responds quickly to habit — often within a week or two of consistent practice.',
  points: [
    {
      title: 'Stay still on waking',
      body: 'Keep your eyes closed and your body quiet. Search backward from the last feeling, image, or thought. Movement and phone light erase fragile memory.',
    },
    {
      title: 'Fragments count',
      body: 'One color, person, place, or emotion is enough. Writing a scrap trains the brain that dreams are worth keeping — more detail returns over time.',
    },
    {
      title: 'Set the intention',
      body: 'Before sleep, briefly decide: “When I wake, I will remember my dreams.” Pair it with a calm visualization of writing something down.',
    },
    {
      title: 'Protect REM',
      body: 'Aim for enough sleep that the last cycles aren’t cut short. Alcohol near bedtime and chronic sleep debt both flatten later REM.',
    },
  ],
}

export const JOURNALING_WHY = {
  lead: 'A dream journal is not only a record — it is training. Each entry tells your mind that dreams matter, strengthens recall, and surfaces the themes that can later trigger lucidity.',
  points: [
    {
      title: 'Memory locks in when written',
      body: 'Dreams fade within minutes. Capturing even a line while still half-asleep preserves material you would otherwise lose forever.',
    },
    {
      title: 'Patterns become visible',
      body: 'Recurring places, people, emotions, and “dream signs” only show up across many nights. Those signs are what reality checks and MILD later use.',
    },
    {
      title: 'Lucidity needs a baseline',
      body: 'Tagging lucidity and induction methods lets you see what actually works for you — instead of guessing from one vivid night.',
    },
    {
      title: 'Morning dump is enough',
      body: 'You do not need a polished story. Dump first, refine later. Voice or a few words beat waiting until the dream is gone.',
    },
  ],
}

export type InductionGuide = {
  id: InductionMethod
  name: InductionMethod
  fullName: string
  summary: string
  how: string
  tip: string
}

const METHOD_GUIDES: Record<InductionMethod, Omit<InductionGuide, 'id' | 'name' | 'summary'>> = {
  DILD: {
    fullName: 'Dream-Initiated Lucid Dream',
    how: 'You become lucid spontaneously inside an ongoing dream — often after spotting something impossible or performing a reality check that fails.',
    tip: 'Strengthen dream signs in your journal and practice daytime awareness so recognition is more likely when something odd appears.',
  },
  MILD: {
    fullName: 'Mnemonic Induction of Lucid Dreams',
    how: 'As you fall asleep, set a clear intention to notice you are dreaming. Often paired with visualizing a recent dream and seeing yourself become lucid in it.',
    tip: 'Works well after a brief wake (WBTB). Keep the phrase short and sincere — curiosity beats mechanical repetition.',
  },
  WBTB: {
    fullName: 'Wake Back To Bed',
    how: 'Sleep ~5–6 hours, wake for 10–30 minutes, then return to sleep. The return lands you closer to long REM periods.',
    tip: 'Stay calm and dim. Use the wake window for intention or light reading about dreaming — not bright screens or intense tasks.',
  },
  WILD: {
    fullName: 'Wake-Initiated Lucid Dream',
    how: 'You keep awareness as the body falls asleep and enter the dream scene without a break in consciousness. Hypnagogic imagery often bridges the way.',
    tip: 'Requires patience and good sleep pressure. If you get stuck in paralysis anxiety, switch to MILD/DILD for a while.',
  },
  DEILD: {
    fullName: 'Dream-Exit Initiated Lucid Dream',
    how: 'After a dream ends or you briefly wake, stay still and “sink” straight back into a dream with awareness intact.',
    tip: 'Ideal when an alarm or natural stir interrupts a vivid dream. Don’t move or open your eyes — re-enter immediately.',
  },
  EILD: {
    fullName: 'Externally Induced Lucid Dream',
    how: 'A cue from outside — light, sound, or a wearable — reaches you during REM and is meant to be noticed inside the dream as a lucidity trigger.',
    tip: 'Train the association while awake (“when I notice the cue, I am dreaming”). Cues help most when recall and intention are already solid.',
  },
  SSILD: {
    fullName: 'Senses-Initiated Lucid Dream',
    how: 'From bed, cycle attention gently through vision, hearing, and bodily sensation in soft rounds, then let go into sleep.',
    tip: 'Keep cycles relaxed and short. The goal is heightened awareness falling into REM — not forcing sensations.',
  },
  FILD: {
    fullName: 'Finger-Induced Lucid Dream',
    how: 'After waking briefly (often with WBTB), make tiny imaginary finger movements as if playing keys, while focusing on the sensation and drifting back to sleep.',
    tip: 'Movements should be almost imperceptible. If you tense up, reset with stillness and try again another night.',
  },
}

export const INDUCTION_GUIDES: InductionGuide[] = INDUCTION_METHODS.map((id) => ({
  id,
  name: id,
  summary: INDUCTION_DESCRIPTIONS[id],
  ...METHOD_GUIDES[id],
}))
