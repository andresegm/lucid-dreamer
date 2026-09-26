export function draftKey(userId: string, kind: 'capture' | 'new') {
  return `ldj.draft.${kind}.${userId}`
}
