export function groupNights<T extends { date: string }>(rows: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.date === row.date) last.items.push(row)
    else groups.push({ date: row.date, items: [row] })
  }
  return groups
}
