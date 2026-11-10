// Embedded sample accounts and credential material were removed from the combined app.
// Static login is disabled; authentication must use the configured production login API.
// export interface StaticLoginEntry { username: string; passwordSha256: string; record: unknown | null }
// export const STATIC_LOGINS: StaticLoginEntry[] = [];
// export const staticLoginActive = (): boolean => false;
// export type StaticLoginResult = { kind: 'match'; record: unknown } | { kind: 'use-api' } | { kind: 'denied' };
// export async function resolveStaticLogin(_username: string, _password: string): Promise<StaticLoginResult> {
//   return { kind: 'use-api' };
// }

export interface StaticLoginEntry {
  username: string;
  passwordSha256: string;
  record: unknown | null;
}

// 1) abc@gmail.com  (Stipl)
export const ABC_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 1,
      email: "abc@gmail.com",
      username: "Stipl",
      mccid: "701",
      mccname: "Stipl",
      mobile: "9999999999",
      status: 1,
      SessionID: "7010101,7010103,7010102,7010105,7010108",
      CustomStationId: "101010",
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 1,
      UserAccess: "0",
      deviceName: "SMARTX",
      lastLogin: "2025-02-19T16:59:48",
      Token: "8be5eb4dc661add82e76dba50e68fe062625x1tr",
      DataEncryption: 0,
      GST: "07ABCDE12345",
      Address: "Sangliii",
      logo: "",
    },
  ],
};

// 2) prachidairykaladera@gmail.com  (Prachi Dairy)
export const PRACHI_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 218,
      email: "prachidairykaladera@gmail.com",
      username: "PRACHI",
      mccid: "119",
      mccname: "Prachi Dairy",
      mobile: "7976161535",
      status: 1,
      SessionID:
        "7090801,7090802,7090803,7090804,7090805,7090806,7090807,7090808,7090809,7090810,7090811,7090812,7090813,7090814",
      CustomStationId:
        "0021000,0022000,0023000,0024000,0025000,0020000,0002000,0017000,0014000,0012000,0006000,0009000,0027000,0028000",
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 19,
      UserAccess: "14",
      deviceName: null,
      lastLogin: null,
      Token: "800f4bca76bb3c6efda26ddaf254a0010526x1tr",
      DataEncryption: 0,
      GST: null,
      Address: "Kaladera",
      logo: null,
    },
  ],
};

// 3) bansidairynagpur@gmail.com  (Bansi Dairy Nagpur)
export const BANSI_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 259,
      email: "bansidairynagpur@gmail.com",
      username: "BANSI",
      mccid: "183",
      mccname: "Bansi Dairy Nagpur",
      mobile: "8691932444",
      status: 1,
      SessionID:
        "7070601,7070602,7070603,7070604,7070605,7070606,7070607,7070608,7070609,7070610,7070611,7070612,7070613,7070614,7070615,7070616,7070617,7070618,7070619,7070620,7070621,7070622,7070623,7070624,7070625,7070626,7070627",
      CustomStationId:
        "0001,0023,0024,0025,0026,0002,0003,0004,0005,0006,0007,0009,0010,0011,0021,0012,0013,0014,0016,0019,0020,0028,0029,0030,0027,0032,0031",
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 50,
      UserAccess: null,
      deviceName: null,
      lastLogin: null,
      Token: "39ab2e18860b6291be8dc3beb8ed19101926x1tr",
      DataEncryption: null,
      GST: null,
      Address: null,
      logo: null,
    },
  ],
};

// 6) thelogicshell@gmail.com  (LogicShell) - same centres and routes as the Bansi login, but its OWN user id (271) so that its own menu / User Access applies
export const LOGICSHELL_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 271, 
      email: "thelogicshell@gmail.com",
      username: "LOGICSHELL",
      mccid: "183",
      mccname: "Bansi Dairy Nagpur",
      mobile: "8691932444",
      status: 1,
      SessionID:
        "7070601,7070602,7070603,7070604,7070605,7070606,7070607,7070608,7070609,7070610,7070611,7070612,7070613,7070614,7070615,7070616,7070617,7070618,7070619,7070620,7070621,7070622,7070623,7070624,7070625,7070626,7070627",
      CustomStationId:
        "0001,0023,0024,0025,0026,0002,0003,0004,0005,0006,0007,0009,0010,0011,0021,0012,0013,0014,0016,0019,0020,0028,0029,0030,0027,0032,0031",
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 50,
      UserAccess: null,
      deviceName: null,
      lastLogin: null,
      Token: "39ab2e18860b6291be8dc3beb8ed19101926x1tr",
      DataEncryption: null,
      GST: null,
      Address: null,
      logo: null,
    },
  ],
};

// 4) kadambari@gmail.com  (Kadambari Dudh)
export const KADAMBARI_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 69,
      email: "kadambari@gmail.com",
      username: "kuldip pol",
      mccid: "706",
      mccname: "Kadambari Dudh",
      mobile: "7720000888",
      status: 1,
      SessionID: "7060245",
      CustomStationId: null,
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 7,
      UserAccess: "4",
      deviceName: "SMARTX",
      lastLogin: "2024-10-01T13:48:17",
      Token: null,
      DataEncryption: 0,
      GST: null,
      Address: null,
      logo: null,
    },
  ],
};

// 5) numaxfoods@gmail.com  (Numax Foods Private Limited)
export const NUMAX_LOGIN_RECORD: unknown | null = {
  Data: [
    {
      id: 191,
      email: "numaxfoods@gmail.com",
      username: "Numax",
      mccid: "118",
      mccname: "Numax Foods Private Limited",
      mobile: "9168172222",
      status: 1,
      SessionID:
        "7090500,7090501,7090502,7090503,7090504,7090505,7090506,7090507,7090508,7090509,7090510,7090511,7090512,7090513,7090514,7090515,7090518,7090519,7090520,7090521,7090523,7090524,7090525,7090526,7090527,7090528,7090528,7090529,7090530,7090531,7090532,7090533",
      CustomStationId:
        "7090500,JNS0100,DPK013,KVS010,SSD07,KAN09,VBS04,INP05,ARR06,JNS01,MKS02,ARS03,EKA08,RKV011,GKS012,MPL014,KLR015,MSP015,KTM016,SRV017,MSG018,PST018,KGP20,KPA21,MSG018,PST018,ARR06,DPK013,RMR022,DMR23,DMR023,DMR23,DCC24,CPL25,NPK26,CKD27,SMS25",
      LoginStatus: 0,
      webLogin: 0,
      PlantId: 18,
      UserAccess: "9",
      deviceName: null,
      lastLogin: null,
      Token: "ce62cf16393704e6e6aa0eb41feef2092925x1tr",
      DataEncryption: 1,
      GST: "33AABCN8709P1Z0",
      Address: "SF589, Karegoundanpalayam (PO), Annur, Coimbatore - 641697",
      logo: "",
    },
  ],
};

// Only these accounts are allowed. Everyone else is denied.
export const STATIC_LOGINS: StaticLoginEntry[] = [
  {
    username: "abc@gmail.com",
    passwordSha256:
      "ef1673ba31fbcdc89d21df47b7e6fcf2d11d703748e16e0da59ffcfc4d3f0746",
    record: ABC_LOGIN_RECORD,
  },
  {
    username: "prachidairykaladera@gmail.com",
    passwordSha256:
      "4afe36d74c8f9bf52726a27ba88168a2dae49e9f751fcbdcbb33634d8d530411",
    record: PRACHI_LOGIN_RECORD,
  },
  {
    username: "bansidairynagpur@gmail.com",
    passwordSha256:
      "da65e43e2a094f208d61fab0f1f35cd8adc15889759dda37e59b4c010aa3a340",
    record: BANSI_LOGIN_RECORD,
  },
  {
    username: "thelogicshell@gmail.com",
    passwordSha256:
      "aa93eb3454c468f60f993efb06f8c71dde2a1a0fefcb8c4bc04e6c5f38cc2ae7",
    record: LOGICSHELL_LOGIN_RECORD,
  },
  {
    username: "kadambari@gmail.com",
    passwordSha256:
      "bf7886799222fe3518017ab6d1518d9908d5e5790081fc9f6b0f6215ed181e53",
    record: KADAMBARI_LOGIN_RECORD,
  },
  {
    username: "numaxfoods@gmail.com",
    passwordSha256:
      "02f330dd8c09caa9ca631ef6980cc60721229d472eca28d39b6113309687cb55",
    record: NUMAX_LOGIN_RECORD,
  },
];

export const staticLoginActive = (): boolean =>
  import.meta.env.VITE_STATIC_LOGIN === "1" &&
  STATIC_LOGINS.some((e) => e.record !== null && e.record !== undefined);

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const recordEmailOf = (record: unknown): string => {
  const outer: any = Array.isArray(record) ? record[0] : record;
  const inner: any =
    outer && Array.isArray(outer.Data) ? outer.Data[0] : (outer?.Data ?? outer);
  return typeof inner?.email === "string" ? inner.email : "";
};

const sameUser = (entry: StaticLoginEntry, username: string): boolean => {
  const allowed = (entry.username || recordEmailOf(entry.record))
    .trim()
    .toLowerCase();
  return !allowed || username.trim().toLowerCase() === allowed;
};

async function passwordOk(
  entry: StaticLoginEntry,
  password: string,
): Promise<boolean> {
  if (!entry.passwordSha256) return true;
  try {
    return (await sha256Hex(password)) === entry.passwordSha256.toLowerCase();
  } catch {
    return false;
  }
}

export type StaticLoginResult =
  | { kind: "match"; record: unknown }
  | { kind: "use-api" }
  | { kind: "denied" };

export async function resolveStaticLogin(
  username: string,
  password: string,
): Promise<StaticLoginResult> {
  for (const entry of STATIC_LOGINS) {
    if (!sameUser(entry, username)) continue;
    if (!(await passwordOk(entry, password))) continue;
    if (entry.record === null || entry.record === undefined)
      return { kind: "use-api" };
    return { kind: "match", record: entry.record };
  }
  return { kind: "denied" };
}