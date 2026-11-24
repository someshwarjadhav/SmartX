import { getSession } from "../services/session";
import { getProfileFromSession } from "../services/profile/profile.api";

export interface BrandLogo {
  key: string;
  name: string;

  src: string;
}

const BRANDS: Array<{ key: string; name: string; test: RegExp; file: string }> =
  [
    { key: "numax", name: "Numax", test: /numax/i, file: "logos/numax.jpeg" },
    {
      key: "nutrymist",
      name: "NutryMist",
      test: /nutr[yr]+mist|nutrition/i,
      file: "logos/nutrymist.jpeg",
    },
  ];

const absolute = (path: string): string => {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  return new URL(
    `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`,
    window.location.origin,
  ).href;
};

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
  const hit = BRANDS.find((b) => b.test.test(text));
  if (!hit) return null;
  return {
    key: hit.key,
    name: hit.name,
    src: serverLogo || absolute(hit.file),
  };
}

/** <img> for the HTML of print / PDF windows. If the file is missing the image just disappears. */
export function brandImgHtml(b: BrandLogo | null, height = 40): string {
  if (!b) return "";
  const src = b.src.replace(/"/g, "&quot;");
  return `<img class="brandlogo" src="${src}" alt="${b.name}" style="height:${height}px;width:auto;max-width:150px;object-fit:contain;display:block" onerror="this.remove()">`;
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
  try {
    const res = await fetch(b.src, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(png|jpe?g)/i.test(blob.type)) return null;
    const data = await new Promise<string>((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => bad(new Error("logo read failed"));
      r.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((ok, bad) => {
      const img = new Image();
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => bad(new Error("logo decode failed"));
      img.src = data;
    });
    if (!size.w || !size.h) return null;
    return { data, format: /png/i.test(blob.type) ? "PNG" : "JPEG", ...size };
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
