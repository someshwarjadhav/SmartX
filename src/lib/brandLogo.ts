import { getSession } from "../services/session";
import { getProfileFromSession } from "../services/profile/profile.api";

export interface BrandLogo {
  key: string;
  name: string;
  /** the logo to use (the first one that really exists) */
  src: string;
  /** tried one after the other when `src` cannot be loaded */
  fallbacks: string[];
}

/**
 * Own logos live in public/logos. A transparent PNG (background removed) is preferred; the older .jpeg is the fallback,
 * so either file works. Put the file in public/logos as numax.png / nutrrymist.png.
 */
const BRANDS: Array<{ key: string; name: string; test: RegExp; files: string[] }> =
  [
    {
      key: "numax",
      name: "Numax",
      test: /numax/i,
      files: ["logos/numax.png", "logos/numax.jpeg"],
    },
    {
      key: "nutrymist",
      name: "NutryMist",
      test: /nutr[yr]+mist|nutrition/i,
      files: ["logos/nutrrymist.png", "logos/nutrrymist.jpeg"],
    },
  ];

/** STIPL logo for every login that has no logo of its own. Put it in public/logos (stipl.jpeg / stipl.png) or anywhere under src/assets. */
const bundledStipl = Object.values(
  import.meta.glob("../assets/**/stipl.{jpeg,jpg,png}", {
    eager: true,
    query: "?url",
    import: "default",
  }) as Record<string, string>,
);
const DEFAULT_BRAND = {
  key: "stipl",
  name: "STIPL",
  files: ["logos/stipl.jpeg", "logos/stipl.png", "logos/stipl.jpg"],
};

const absolute = (path: string): string => {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  return new URL(
    `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`,
    window.location.origin,
  ).href;
};

/** which file of a login really exists (found once by trying to load it, then remembered) */
const found = new Map<string, string>();
const probing = new Set<string>();
function probe(key: string, urls: string[]): void {
  if (found.has(key) || probing.has(key) || typeof Image === "undefined") return;
  probing.add(key);
  const next = (i: number) => {
    if (i >= urls.length) {
      probing.delete(key);
      return;
    }
    const img = new Image();
    img.onload = () => {
      found.set(key, urls[i]!);
      probing.delete(key);
    };
    img.onerror = () => next(i + 1);
    img.src = urls[i]!;
  };
  next(0);
}

/** The logo of the logged-in dairy: Numax / NutryMist have their own, every other login gets the STIPL logo. */
export function getBrandLogo(): BrandLogo | null {
  let text = "";
  let serverLogo = "";
  try {
    const s = getSession();
    const p = getProfileFromSession();
    text = [s?.mccName, s?.scope, p.mccname, p.username, p.email]
      .filter(Boolean)
      .join(" ");
    serverLogo = p.logoUrl || "";
  } catch {
    /* no login yet */
  }
  // Numax / NutryMist use their own logo; every other login uses the STIPL logo
  const hit = BRANDS.find((b) => b.test.test(text)) ?? DEFAULT_BRAND;
  const urls = [
    ...hit.files.map(absolute),
    ...(hit.key === "stipl" ? bundledStipl : []),
    ...(serverLogo && hit.key !== "stipl" ? [serverLogo] : []),
  ];
  probe(hit.key, urls);
  const src = found.get(hit.key) ?? urls[0]!;
  return {
    key: hit.key,
    name: hit.name,
    src,
    fallbacks: urls.filter((u) => u !== src),
  };
}

/** Every login gets the same centred title block (logo on the left). */
export const isCenteredBrand = (): boolean => true;

/** <img> for the HTML of print / PDF windows. If the file is missing the image just disappears. */
export function brandImgHtml(b: BrandLogo | null, height = 40, maxWidth = 150): string {
  if (!b) return "";
  const q = (v: string) => v.replace(/"/g, "&quot;");
  const fb = q(b.fallbacks.join("|"));
  return `<img class="brandlogo" src="${q(b.src)}" data-fb="${fb}" alt="${q(b.name)}" style="height:${height}px;width:auto;max-width:${maxWidth}px;object-fit:contain;display:block" onerror="var f=(this.dataset.fb||'').split('|').filter(Boolean);if(f.length){this.dataset.fb=f.slice(1).join('|');this.src=f[0]}else{this.remove()}">`;
}

export interface LogoPixels {
  data: string;
  format: "PNG" | "JPEG";
  w: number;
  h: number;
}

/** Logo as picture data for jsPDF. Returns null when the image cannot be read (the PDF is then made without it). */
export async function loadLogoPixels(
  b: BrandLogo | null,
): Promise<LogoPixels | null> {
  if (!b) return null;
  for (const url of [b.src, ...b.fallbacks]) {
    const one = await loadOne(url);
    if (one) return one;
  }
  return null;
}

async function loadOne(url: string): Promise<LogoPixels | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\//i.test(blob.type)) return null;
    const raw = await new Promise<string>((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => bad(new Error("logo read failed"));
      r.readAsDataURL(blob);
    });
    // the real type is read from the file itself (a PNG saved with a .jpeg name still works)
    const b64 = raw.split(",")[1] ?? "";
    const isPng = b64.startsWith("iVBOR");
    const isJpeg = b64.startsWith("/9j/");
    if (!isPng && !isJpeg) return null;
    const data = `data:image/${isPng ? "png" : "jpeg"};base64,${b64}`;
    const size = await new Promise<{ w: number; h: number }>((ok, bad) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => bad(new Error("logo decode failed"));
      img.src = data;
    });
    if (!size.w || !size.h) return null;
    return { data, format: isPng ? "PNG" : "JPEG", ...size };
  } catch {
    return null;
  }
}

export function printWhenImagesReady(win: Window, maxWaitMs = 2500): void {
  const imgs = Array.from(win.document.images);
  const pending = imgs.filter((i) => !i.complete);
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    win.focus();
    win.print();
  };
  if (pending.length === 0) {
    window.setTimeout(go, 300);
    return;
  }
  let left = pending.length;
  const one = () => {
    left -= 1;
    if (left <= 0) window.setTimeout(go, 150);
  };
  pending.forEach((i) => {
    i.addEventListener("load", one);
    i.addEventListener("error", one);
  });
  window.setTimeout(go, maxWaitMs);
}
