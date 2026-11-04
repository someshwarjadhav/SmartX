/**
 * "CSV Export" file that Excel opens with every column already as wide as its longest value.
 *
 * A plain CSV cannot hold column widths, so Excel shows it with narrow columns and cuts names. The same table is written in
 * SYLK (a text format Excel reads by its first line "ID;", even when the file is called .csv) which carries the widths.
 * Excel opens it like a normal sheet; apps that only understand plain CSV (e.g. Google Sheets) will not read it.
 */
const text = (v: string | number): string => String(v ?? '').replace(/[\r\n]+/g, ' ');
// SYLK has no reliable way to escape a double quote inside text, so it becomes a single quote
const quote = (v: string): string => `"${v.replace(/"/g, "'").replace(/;/g, ';;')}"`;

export function toSylk(head: string[], rows: Array<Array<string | number>>): string {
  const widths = head.map((h, i) => {
    let longest = text(h).length;
    for (const r of rows) longest = Math.max(longest, text(r[i] ?? '').length);
    return Math.min(70, Math.max(9, longest + 2));
  });
  const out: string[] = ['ID;PWXL;N;E', `B;Y${rows.length + 1};X${head.length}`];
  widths.forEach((w, i) => out.push(`F;W${i + 1} ${i + 1} ${w}`));
  const cell = (y: number, x: number, v: string | number, bold: boolean): string =>
    `C;Y${y};X${x};K${typeof v === 'number' && Number.isFinite(v) ? String(v) : quote(text(v))}${bold ? '' : ''}`;
  head.forEach((h, i) => out.push(cell(1, i + 1, h, true)));
  rows.forEach((r, ri) => head.forEach((_, ci) => {
    const v = r[ci];
    if (v === undefined || v === '') return;
    out.push(cell(ri + 2, ci + 1, v, false));
  }));
  out.push('E');
  return out.join('\r\n') + '\r\n';
}
