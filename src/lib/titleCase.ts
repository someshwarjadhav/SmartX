/**
 * Names (farmers, centres, plants / routes) are shown with only the FIRST letter of every word in capitals:
 * "VANDANA G BHENDARE" / "barbadi-wardha" -> "Vandana G Bhendare" / "Barbadi-Wardha".
 */
export const titleCase = (value: string | null | undefined): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // centre / station codes like NMD101 stay in capitals
    .replace(/\b[a-z]{2,5}\d+\b/g, (m) => m.toUpperCase())
    .replace(/(^|[\s\-/(.&])([a-z\u00c0-\u024f])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

/** Plant / route names show only the name: "Suklibai Route" -> "Suklibai". */
export const stripRoute = (value: string | null | undefined): string => {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  const out = s.replace(/[\s\-_]*\broute\b\s*$/i, '').trim();
  return out || s;
};
