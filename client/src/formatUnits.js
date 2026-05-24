export function pluralizeUnitLabel(label) {
  const value = String(label || '').trim();
  if (!value) return 'units';

  const lower = value.toLowerCase();
  if (lower.endsWith('s')) return lower;
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  if (/(ch|sh|x|z)$/.test(lower)) return `${lower}es`;
  return `${lower}s`;
}

export function getUnitLabel(vice, fallback = 'units') {
  if (!vice) return fallback;

  const explicit = String(vice.unit_label || '').trim();
  if (explicit && explicit.toLowerCase() !== 'unit' && explicit.toLowerCase() !== 'units') {
    return explicit;
  }

  return pluralizeUnitLabel(vice.name) || fallback;
}

export function formatQuantityWithUnit(quantity, vice) {
  const n = Number(quantity || 0);
  const formatted = n % 1 === 0 ? String(n) : n.toFixed(1);
  return `${formatted} ${getUnitLabel(vice)}`;
}
