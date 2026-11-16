import { getSession } from '../session';
import { VILLAGE_NAMES } from './villages';

const learnt = new Map<string, string>();

export function rememberVlccName(id: string, name: string) {
  const n = name.trim();
  if (id && n) learnt.set(id, n);
}

export const vlccName = (id: string): string => learnt.get(id) || getSession()?.vlccNames?.[id] || VILLAGE_NAMES[id] || '';

export const vlccTitle = (id: string, fallbackName = ''): string => vlccName(id) || fallbackName.trim() || `VLC ${id}`;

/** the custom station id of a VLC ("0001" - the number shown next to its name in every dropdown); the id itself when it has none */
export const vlccCode = (id: string): string => (id && getSession()?.stationByVlcc?.[id]) || id;

export const vlccOption = (id: string): string => {
  const n = vlccName(id);
  const code = getSession()?.stationByVlcc?.[id] || id;
  return n ? `${n} | ${code}` : code;
};
