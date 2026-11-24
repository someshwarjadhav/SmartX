import type { LogoPixels } from "../../lib/brandLogo";

/** Rows kept empty at the top of the sheet for the logo (about 100 px). */
export const LOGO_ROWS = 5;
const LOGO_MAX_W = 220;
const LOGO_MAX_H = 90;
const EMU = 9525; // 1 px

export async function addLogoToXlsx(
  buffer: ArrayBuffer,
  logo: LogoPixels,
): Promise<ArrayBuffer> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const sheetPath = "xl/worksheets/sheet1.xml";
    const sheetFile = zip.file(sheetPath);
    const typesFile = zip.file("[Content_Types].xml");
    if (!sheetFile || !typesFile) return buffer;

    const ext = logo.format === "PNG" ? "png" : "jpeg";
    const k = Math.min(LOGO_MAX_W / logo.w, LOGO_MAX_H / logo.h);
    const cx = Math.round(logo.w * k * EMU);
    const cy = Math.round(logo.h * k * EMU);

    zip.file(`xl/media/dairylogo.${ext}`, logo.data.split(",")[1] ?? "", {
      base64: true,
    });

    zip.file(
      "xl/drawings/drawing1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${4 * EMU}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${4 * EMU}</xdr:rowOff></xdr:from>` +
        `<xdr:ext cx="${cx}" cy="${cy}"/>` +
        `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo" descr="Dairy logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
        `<xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`,
    );
    zip.file(
      "xl/drawings/_rels/drawing1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/dairylogo.${ext}"/></Relationships>`,
    );

    // sheet -> drawing link
    const relsPath = "xl/worksheets/_rels/sheet1.xml.rels";
    const relLine = `<Relationship Id="rIdLogo1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;
    const relsFile = zip.file(relsPath);
    if (relsFile) {
      const rels = await relsFile.async("string");
      zip.file(
        relsPath,
        rels.replace("</Relationships>", `${relLine}</Relationships>`),
      );
    } else {
      zip.file(
        relsPath,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relLine}</Relationships>`,
      );
    }

    // <drawing/> goes after the page settings and before legacyDrawing / tableParts
    let sheet = await sheetFile.async("string");
    if (!/<worksheet[^>]*xmlns:r=/.test(sheet)) {
      sheet = sheet.replace(
        "<worksheet",
        '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
      );
    }
    const tag = '<drawing r:id="rIdLogo1"/>';
    if (/<legacyDrawing|<tableParts/.test(sheet))
      sheet = sheet.replace(/<legacyDrawing|<tableParts/, (m) => `${tag}${m}`);
    else sheet = sheet.replace("</worksheet>", `${tag}</worksheet>`);
    zip.file(sheetPath, sheet);

    // content types
    let types = await typesFile.async("string");
    if (!new RegExp(`Extension="${ext}"`, "i").test(types)) {
      types = types.replace(
        "<Override",
        `<Default Extension="${ext}" ContentType="image/${ext}"/><Override`,
      );
    }
    types = types.replace(
      "</Types>",
      `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );
    zip.file("[Content_Types].xml", types);

    return await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
    });
  } catch {
    return buffer;
  }
}

export async function saveWorkbook(
  XLSX: typeof import("xlsx"),
  wb: import("xlsx").WorkBook,
  fileName: string,
  logo: LogoPixels | null,
): Promise<void> {
  if (!logo) {
    XLSX.writeFile(wb, fileName, { compression: true });
    return;
  }
  const raw = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer;
  const out = await addLogoToXlsx(raw, logo);
  const url = URL.createObjectURL(
    new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
