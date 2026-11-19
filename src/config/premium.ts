/**
 * Premium (cloud storage) plan: the prices and years live here, so next year only this file changes.
 * Rule of the notice sent to customers:
 *   - Annual renewal ............ Rs 1000 per Station ID (for `renewalYear`)
 *   - Keep previous year data ... Rs 750 per Station ID per year (last year), Rs 450 (the year before)
 *   - Not kept .................. deleted exactly one year after the data was created (rolling deletion)
 */
export const PREMIUM_PLAN = {
  /** financial year the renewal is for: 2026 = 2026-27 */
  renewalYear: 2026,
  renewalPerStation: 1000,
  /** years of old data that can be kept: `back` = how many years before renewalYear */
  retention: [
    { back: 1, perStation: 750 },
    { back: 2, perStation: 450 },
  ],
  /** last day to confirm, yyyy-MM-dd. Leave '' until the date is decided: the page then shows no date */
  renewalDate: '',
  /** how long un-kept data stays on the server */
  deleteAfterYears: 1,
} as const;

/** 2026 -> "2026-27" */
export const fyLabel = (y: number): string => `${y}-${String(y + 1).slice(-2)}`;
