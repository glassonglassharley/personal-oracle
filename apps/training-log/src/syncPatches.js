export function mergeSavePatches(current, next) {
  if (!next || Object.keys(next).length === 0) return current || {}
  return { ...(current || {}), ...next }
}
