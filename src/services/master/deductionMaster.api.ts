import { GLOBALS } from "../../lib/portal/global";
import { ApiError } from "../http/errors";

/**
 * Deduction Master (menu: Master > Head Master) - the list of deductions / additions that a farmer bill can carry,
 * e.g. Milk Advance, Cattle Feed, Commission, Transport.
 *
 * STORE: the DPU gateway does not publish a head-master endpoint yet, so the records are kept per plant in this browser
 * (localStorage). Only the four functions below touch the store (listHeads / saveHead / deleteHead + the seed), so when
 * the real endpoints are known, change those functions and nothing in the pages has to move.
 */

export const DEDUCTION_TYPES = [
  "Standard",
  "Percentage",
  "Variable",
  "Fix",
  "On Bill Wise",
] as const;
export type DeductionType = (typeof DEDUCTION_TYPES)[number];

export const NATURES = ["Deduction", "Addition"] as const;
export type Nature = (typeof NATURES)[number];

export const NAME_MAX = 50;
const FIRST_CODE = 5001;

export interface DeductionHead {
  /** Auto-generated, never edited: 5001, 5002 ... */
  code: string;
  name: string;
  type: DeductionType;
  nature: Nature;
}

export interface HeadInput {
  name: string;
  type: DeductionType | "";
  nature: Nature;
}

export type HeadErrors = Partial<Record<"name" | "type" | "nature", string>>;

export const emptyHead = (): HeadInput => ({
  name: "",
  type: "",
  nature: "Deduction",
});

/* ------------------------------------------------------------------ store */

const scope = () => String(GLOBALS.plantid || GLOBALS.mccid || "default");
export const HEADS_KEY = () => `smartx.deductionMaster.${scope()}`;

/** true: the first time a plant opens this page it gets the sample list below. Set false to start with an empty list. */
export const SEED_SAMPLE_DATA = true;

const SAMPLE: DeductionHead[] = [
  { code: "5001", name: "Milk Advance", type: "Variable", nature: "Deduction" },
  { code: "5002", name: "Cattle Feed", type: "Variable", nature: "Deduction" },
  { code: "5003", name: "Commission", type: "Standard", nature: "Deduction" },
  { code: "5004", name: "Transport", type: "Fix", nature: "Deduction" },
  { code: "5005", name: "Loan Recovery", type: "Fix", nature: "Deduction" },
  { code: "5006", name: "Insurance", type: "Fix", nature: "Deduction" },
  { code: "5007", name: "Member Thev", type: "Standard", nature: "Deduction" },
  { code: "5008", name: "Group Advance", type: "Percentage", nature: "Deduction" },
  { code: "5009", name: "Vet Medicine", type: "On Bill Wise", nature: "Deduction" },
  { code: "5010", name: "Incentive", type: "Standard", nature: "Addition" },
  { code: "5011", name: "Bonus", type: "Percentage", nature: "Addition" },
];

const SEED: DeductionHead[] = SEED_SAMPLE_DATA ? SAMPLE : [];

const isType = (v: unknown): v is DeductionType =>
  (DEDUCTION_TYPES as readonly string[]).includes(String(v));
const isNature = (v: unknown): v is Nature =>
  (NATURES as readonly string[]).includes(String(v));

function clean(v: unknown): DeductionHead[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: DeductionHead[] = [];
  for (const r of v) {
    if (typeof r !== "object" || r === null) continue;
    const o = r as Record<string, unknown>;
    const code = String(o.code ?? "").trim();
    const name = String(o.name ?? "").trim();
    if (!code || !name || seen.has(code) || !isType(o.type)) continue;
    seen.add(code);
    out.push({
      code,
      name,
      type: o.type,
      nature: isNature(o.nature) ? o.nature : "Deduction",
    });
  }
  return out;
}

function readStore(): DeductionHead[] {
  try {
    const raw = localStorage.getItem(HEADS_KEY());
    if (raw === null) {
      localStorage.setItem(HEADS_KEY(), JSON.stringify(SEED));
      return SEED.map((h) => ({ ...h }));
    }
    return clean(JSON.parse(raw));
  } catch {
    return SEED.map((h) => ({ ...h })); // storage blocked: still show the sample list
  }
}

function writeStore(rows: DeductionHead[]): void {
  try {
    localStorage.setItem(HEADS_KEY(), JSON.stringify(rows));
  } catch {
    throw new ApiError(
      "The deduction could not be saved in this browser (storage is full or blocked).",
      "server",
    );
  }
}

const byCode = (a: DeductionHead, b: DeductionHead) =>
  Number(a.code) - Number(b.code) || a.code.localeCompare(b.code);

/* ------------------------------------------------------------------ rules */

export const normName = (s: string) => s.trim().replace(/\s+/g, " ");

export function validateHead(
  input: HeadInput,
  existing: DeductionHead[],
  editingCode?: string,
): HeadErrors {
  const e: HeadErrors = {};
  const name = normName(input.name);
  if (!name) e.name = "Deduction name is required.";
  else if (name.length > NAME_MAX)
    e.name = `Name can be at most ${NAME_MAX} characters.`;
  else if (
    existing.some(
      (h) =>
        h.code !== editingCode && h.name.toLowerCase() === name.toLowerCase(),
    )
  )
    e.name = "A deduction with this name already exists.";
  if (!input.type) e.type = "Select a deduction type.";
  if (!isNature(input.nature)) e.nature = "Select Deduction or Addition.";
  return e;
}

/* ------------------------------------------------------------------ calls (swap these for the API) */

export async function listHeads(): Promise<DeductionHead[]> {
  return readStore().sort(byCode);
}

export async function saveHead(
  input: HeadInput,
  editingCode?: string,
): Promise<DeductionHead> {
  const rows = readStore();
  const errors = validateHead(input, rows, editingCode);
  const first = Object.values(errors)[0];
  if (first) throw new ApiError(first, "config");
  const type = input.type as DeductionType;
  const name = normName(input.name);

  if (editingCode) {
    const at = rows.findIndex((h) => h.code === editingCode);
    if (at < 0)
      throw new ApiError("This deduction no longer exists.", "server");
    const next = { ...rows[at], name, type, nature: input.nature };
    rows[at] = next;
    writeStore(rows);
    return next;
  }
  const max = rows.reduce((m, h) => Math.max(m, Number(h.code) || 0), FIRST_CODE - 1);
  const created: DeductionHead = {
    code: String(max + 1),
    name,
    type,
    nature: input.nature,
  };
  writeStore([...rows, created]);
  return created;
}

export async function deleteHead(code: string): Promise<void> {
  const rows = readStore();
  if (!rows.some((h) => h.code === code))
    throw new ApiError("This deduction no longer exists.", "server");
  writeStore(rows.filter((h) => h.code !== code));
}
