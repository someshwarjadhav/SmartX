/**
 * Current milk shift, by the clock of the device:
 *   Morning  04:00 - 11:59   (the morning shift ends at 12 noon)
 *   Evening  12:00 - 03:59   (from 12 noon until the next morning shift starts at 4)
 */
export type ShiftName = 'Morning' | 'Evening';

export const MORNING_STARTS_AT = 4;
export const EVENING_STARTS_AT = 12;

export function currentShift(now: Date = new Date()): ShiftName {
  const h = now.getHours();
  return h >= MORNING_STARTS_AT && h < EVENING_STARTS_AT ? 'Morning' : 'Evening';
}
