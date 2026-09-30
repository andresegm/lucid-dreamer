import type { Dispatch, SetStateAction } from 'react'
import { setFavorite } from './api'

type Fav = { id: string; favorite: boolean }

function flip<T extends Fav>(rows: T[], id: string, favorite: boolean): T[] {
  return rows.map((r) => (r.id === id ? { ...r, favorite } : r))
}

/** Optimistic star toggle for a list. Rolls back the row if the save fails. */
export async function toggleListFavorite<T extends Fav>(
  dream: T,
  setRows: Dispatch<SetStateAction<T[]>>,
): Promise<void> {
  const next = !dream.favorite
  setRows((rs) => flip(rs, dream.id, next))
  try {
    await setFavorite(dream.id, next)
  } catch {
    setRows((rs) => flip(rs, dream.id, dream.favorite))
  }
}

/** Same toggle when the list state can still be null while loading. */
export async function toggleNullableListFavorite<T extends Fav>(
  dream: T,
  setRows: Dispatch<SetStateAction<T[] | null>>,
): Promise<void> {
  const next = !dream.favorite
  setRows((rs) => (rs ? flip(rs, dream.id, next) : rs))
  try {
    await setFavorite(dream.id, next)
  } catch {
    setRows((rs) => (rs ? flip(rs, dream.id, dream.favorite) : rs))
  }
}

/** Optimistic star toggle for a single open dream. */
export async function toggleOneFavorite<T extends Fav>(
  dream: T,
  setDream: Dispatch<SetStateAction<T | null>>,
): Promise<void> {
  setDream({ ...dream, favorite: !dream.favorite })
  try {
    await setFavorite(dream.id, !dream.favorite)
  } catch {
    setDream(dream)
  }
}
