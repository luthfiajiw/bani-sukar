import type { jsPDF } from 'jspdf';
import { formatDateId } from '@/lib/format';
import { MM_TO_PT } from './constants';
import { getPosterPhysicalDimensions } from './paginator-poster';
import { getPrintThemePalette, type PrintThemeTokens } from './theme';
import type {
  ExportExecutionOptions,
  ExportScene,
  ExportSettings,
  ExportSummaryStats,
  PosterPaginationResult,
  PosterTile,
  SceneBoundsRect,
  ScenePrimitive,
} from './types';

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Proses pembuatan PDF dibatalkan', 'AbortError');
  }
  const err = new Error('Proses pembuatan PDF dibatalkan');
  err.name = 'AbortError';
  return err;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function parseHexRgb(hex: string | undefined): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  if (cleaned.length >= 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r, g, b];
    }
  }
  return [0, 0, 0];
}

/**
 * Menormalkan karakter Unicode non-WinAnsi agar font bawaan PDF (Helvetica)
 * tetap terbaca bersih tanpa simbol rusak.
 */
function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u203a/g, '>')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=');
}

function setDashMm(
  doc: jsPDF,
  dasharray: string | undefined,
  scale: number,
): boolean {
  if (!dasharray) return false;
  const parts = dasharray
    .trim()
    .split(/[\s,]+/)
    .map((n) => Number(n) * scale)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length === 0) return false;
  doc.setLineDashPattern(parts, 0);
  return true;
}

function drawSvgPathInPdf(
  doc: jsPDF,
  d: string,
  mapX: (x: number) => number,
  mapY: (y: number) => number,
  style: 'S' | 'F' | 'FD',
): void {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return;

  let i = 0;
  let cmd = '';
  let curX = 0;
  let curY = 0;
  let hasSegments = false;

  const nextNum = (): number => {
    const raw = tokens[i++];
    const val = Number(raw);
    return Number.isFinite(val) ? val : 0;
  };

  const isCommand = (tok: string | undefined): boolean =>
    Boolean(tok && /^[a-zA-Z]$/.test(tok));

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      cmd = tokens[i++];
    }

    switch (cmd) {
      case 'M': {
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        doc.moveTo(mapX(x), mapY(y));
        hasSegments = true;
        cmd = 'L';
        break;
      }
      case 'm': {
        const x = curX + nextNum();
        const y = curY + nextNum();
        curX = x;
        curY = y;
        doc.moveTo(mapX(x), mapY(y));
        hasSegments = true;
        cmd = 'l';
        break;
      }
      case 'L': {
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        doc.lineTo(mapX(x), mapY(y));
        hasSegments = true;
        break;
      }
      case 'l': {
        const x = curX + nextNum();
        const y = curY + nextNum();
        curX = x;
        curY = y;
        doc.lineTo(mapX(x), mapY(y));
        hasSegments = true;
        break;
      }
      case 'H': {
        const x = nextNum();
        curX = x;
        doc.lineTo(mapX(curX), mapY(curY));
        hasSegments = true;
        break;
      }
      case 'h': {
        curX += nextNum();
        doc.lineTo(mapX(curX), mapY(curY));
        hasSegments = true;
        break;
      }
      case 'V': {
        const y = nextNum();
        curY = y;
        doc.lineTo(mapX(curX), mapY(curY));
        hasSegments = true;
        break;
      }
      case 'v': {
        curY += nextNum();
        doc.lineTo(mapX(curX), mapY(curY));
        hasSegments = true;
        break;
      }
      case 'C': {
        const x1 = nextNum();
        const y1 = nextNum();
        const x2 = nextNum();
        const y2 = nextNum();
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        doc.curveTo(
          mapX(x1),
          mapY(y1),
          mapX(x2),
          mapY(y2),
          mapX(x),
          mapY(y),
        );
        hasSegments = true;
        break;
      }
      case 'c': {
        const x1 = curX + nextNum();
        const y1 = curY + nextNum();
        const x2 = curX + nextNum();
        const y2 = curY + nextNum();
        const x = curX + nextNum();
        const y = curY + nextNum();
        curX = x;
        curY = y;
        doc.curveTo(
          mapX(x1),
          mapY(y1),
          mapX(x2),
          mapY(y2),
          mapX(x),
          mapY(y),
        );
        hasSegments = true;
        break;
      }
      case 'Z':
      case 'z': {
        doc.close();
        break;
      }
      default: {
        i += 1;
        break;
      }
    }
  }

  if (!hasSegments) return;
  if (style === 'FD') {
    doc.fillStroke();
  } else if (style === 'F') {
    doc.fill();
  } else {
    doc.stroke();
  }
}

function primitiveIntersectsCrop(
  prim: ScenePrimitive,
  cropRect: SceneBoundsRect,
): boolean {
  const margin = 16;
  const minX = cropRect.x - margin;
  const minY = cropRect.y - margin;
  const maxX = cropRect.x + cropRect.width + margin;
  const maxY = cropRect.y + cropRect.height + margin;

  switch (prim.kind) {
    case 'rect':
    case 'image':
      return (
        prim.x + prim.width >= minX &&
        prim.x <= maxX &&
        prim.y + prim.height >= minY &&
        prim.y <= maxY
      );
    case 'circle':
      return (
        prim.cx + prim.r >= minX &&
        prim.cx - prim.r <= maxX &&
        prim.cy + prim.r >= minY &&
        prim.cy - prim.r <= maxY
      );
    case 'text': {
      const approxWidth = Math.max(24, prim.text.length * prim.fontSize * 0.75);
      const startX =
        prim.anchor === 'end'
          ? prim.x - approxWidth
          : prim.anchor === 'middle'
            ? prim.x - approxWidth / 2
            : prim.x;
      const endX = startX + approxWidth;
      return (
        endX >= minX &&
        startX <= maxX &&
        prim.y + prim.fontSize >= minY &&
        prim.y - prim.fontSize * 1.5 <= maxY
      );
    }
    case 'path':
      return true;
  }
}

function resolveDataUrlImageFormat(href: string): 'PNG' | 'JPEG' | 'WEBP' | null {
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,/i.exec(href);
  if (!match) return null;
  const subtype = match[1].toLowerCase();
  if (subtype === 'png') return 'PNG';
  if (subtype === 'jpeg' || subtype === 'jpg') return 'JPEG';
  if (subtype === 'webp') return 'WEBP';
  return null;
}

function renderScenePrimitivesInBox(
  doc: jsPDF,
  primitives: ScenePrimitive[],
  offsetXMm: number,
  offsetYMm: number,
  originSceneX: number,
  originSceneY: number,
  scale: number,
  options?: { skipText?: boolean; skipImages?: boolean },
): void {
  const mapX = (sx: number) => offsetXMm + (sx - originSceneX) * scale;
  const mapY = (sy: number) => offsetYMm + (sy - originSceneY) * scale;

  for (const prim of primitives) {
    switch (prim.kind) {
      case 'rect': {
        const x = mapX(prim.x);
        const y = mapY(prim.y);
        const w = prim.width * scale;
        const h = prim.height * scale;
        const hasFill = Boolean(prim.fill && prim.fill !== 'none');
        const hasStroke = Boolean(
          prim.stroke && prim.stroke !== 'none' && (prim.strokeWidth ?? 1) > 0,
        );
        if (!hasFill && !hasStroke) break;

        if (hasFill) {
          const [r, g, b] = parseHexRgb(prim.fill);
          doc.setFillColor(r, g, b);
        }
        if (hasStroke) {
          const [r, g, b] = parseHexRgb(prim.stroke);
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(Math.max(0.08, (prim.strokeWidth ?? 1) * scale));
        }

        const dashed = hasStroke && setDashMm(doc, prim.strokeDasharray, scale);
        const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
        const rx = (prim.rx ?? 0) * scale;

        if (rx > 0.05) {
          const clampedRx = Math.min(rx, w / 2, h / 2);
          doc.roundedRect(x, y, w, h, clampedRx, clampedRx, style);
        } else {
          doc.rect(x, y, w, h, style);
        }

        if (dashed) {
          doc.setLineDashPattern([], 0);
        }
        break;
      }

      case 'circle': {
        const cx = mapX(prim.cx);
        const cy = mapY(prim.cy);
        const r = Math.max(0.05, prim.r * scale);
        const hasFill = Boolean(prim.fill && prim.fill !== 'none');
        const hasStroke = Boolean(
          prim.stroke && prim.stroke !== 'none' && (prim.strokeWidth ?? 1) > 0,
        );
        if (!hasFill && !hasStroke) break;

        if (hasFill) {
          const [fr, fg, fb] = parseHexRgb(prim.fill);
          doc.setFillColor(fr, fg, fb);
        }
        if (hasStroke) {
          const [sr, sg, sb] = parseHexRgb(prim.stroke);
          doc.setDrawColor(sr, sg, sb);
          doc.setLineWidth(Math.max(0.08, (prim.strokeWidth ?? 1) * scale));
        }
        const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
        doc.circle(cx, cy, r, style);
        break;
      }

      case 'path': {
        const hasFill = Boolean(prim.fill && prim.fill !== 'none');
        const hasStroke = Boolean(
          prim.stroke && prim.stroke !== 'none' && prim.strokeWidth > 0,
        );
        if (!hasFill && !hasStroke) break;

        if (hasFill) {
          const [fr, fg, fb] = parseHexRgb(prim.fill);
          doc.setFillColor(fr, fg, fb);
        }
        if (hasStroke) {
          const [sr, sg, sb] = parseHexRgb(prim.stroke);
          doc.setDrawColor(sr, sg, sb);
          doc.setLineWidth(Math.max(0.08, prim.strokeWidth * scale));
          doc.setLineCap('round');
          doc.setLineJoin('round');
        }

        const dashed = hasStroke && setDashMm(doc, prim.strokeDasharray, scale);
        const style: 'S' | 'F' | 'FD' =
          hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';

        drawSvgPathInPdf(doc, prim.d, mapX, mapY, style);

        if (dashed) {
          doc.setLineDashPattern([], 0);
        }
        break;
      }

      case 'text': {
        if (options?.skipText) break;
        const textVal = sanitizePdfText(prim.text);
        if (!textVal) break;

        const fontPt = Math.max(1.5, prim.fontSize * scale * MM_TO_PT);
        const [tr, tg, tb] = parseHexRgb(prim.fill);
        const fontStyle =
          prim.fontWeight === 'bold' || prim.fontWeight === 'semibold'
            ? 'bold'
            : 'normal';

        doc.setFont('helvetica', fontStyle);
        doc.setFontSize(fontPt);
        doc.setTextColor(tr, tg, tb);

        const align =
          prim.anchor === 'middle'
            ? 'center'
            : prim.anchor === 'end'
              ? 'right'
              : 'left';

        doc.text(textVal, mapX(prim.x), mapY(prim.y), { align });
        break;
      }

      case 'image': {
        if (options?.skipImages) break;
        const imgFormat = resolveDataUrlImageFormat(prim.href);
        if (!imgFormat) break;

        const x = mapX(prim.x);
        const y = mapY(prim.y);
        const w = prim.width * scale;
        const h = prim.height * scale;

        try {
          if (prim.clipCircle) {
            doc.saveGraphicsState();
            const r = Math.min(w, h) / 2;
            doc.circle(x + w / 2, y + h / 2, r, null);
            doc.clip();
            doc.discardPath();
            doc.addImage(prim.href, imgFormat, x, y, w, h, undefined, 'FAST');
            doc.restoreGraphicsState();
          } else {
            doc.addImage(prim.href, imgFormat, x, y, w, h, undefined, 'FAST');
          }
        } catch {
          // Abaikan gambar rusak agar proses PDF tidak gagal
        }
        break;
      }
    }
  }
}

function drawLegendStrip(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: PrintThemeTokens,
): void {
  const [bgR, bgG, bgB] = parseHexRgb(palette.cardBloodBg);
  const [bdR, bdG, bdB] = parseHexRgb(palette.legendBorder);
  const [txR, txG, txB] = parseHexRgb(palette.textSecondary);

  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(bdR, bdG, bdB);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  const cy = y + height / 2;
  const itemW = width / 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(txR, txG, txB);

  // 1. Keturunan (Nasab)
  const x1 = x + 3;
  const [cbR, cbG, cbB] = parseHexRgb(palette.cardBorder);
  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(cbR, cbG, cbB);
  doc.setLineWidth(0.35);
  doc.roundedRect(x1, cy - 2, 5, 4, 0.8, 0.8, 'FD');
  doc.text('Keturunan (Nasab)', x1 + 6.5, cy + 1);

  // 2. Pasangan / Menantu
  const x2 = x + itemW + 2;
  const [sbR, sbG, sbB] = parseHexRgb(palette.cardSpouseBg);
  const [sbdR, sbdG, sbdB] = parseHexRgb(palette.cardSpouseBorder);
  doc.setFillColor(sbR, sbG, sbB);
  doc.setDrawColor(sbdR, sbdG, sbdB);
  doc.setLineDashPattern([1, 0.8], 0);
  doc.roundedRect(x2, cy - 2, 5, 4, 0.8, 0.8, 'FD');
  doc.setLineDashPattern([], 0);
  doc.text('Menantu / Pasangan', x2 + 6.5, cy + 1);

  // 3. Menikah
  const x3 = x + itemW * 2 + 2;
  const [emR, emG, emB] = parseHexRgb(palette.edgeMarried);
  doc.setDrawColor(emR, emG, emB);
  doc.setLineWidth(0.5);
  doc.line(x3, cy, x3 + 6, cy);
  doc.text('Menikah', x3 + 7.5, cy + 1);

  // 4. Bercerai
  const x4 = x + itemW * 3 + 2;
  const [edR, edG, edB] = parseHexRgb(palette.edgeDivorced);
  doc.setDrawColor(edR, edG, edB);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.line(x4, cy, x4 + 6, cy);
  doc.setLineDashPattern([], 0);
  doc.text('Bercerai (//)', x4 + 7.5, cy + 1);

  // 5. Hidup
  const x5 = x + itemW * 4 + 2;
  const [alR, alG, alB] = parseHexRgb(palette.aliveDotFill);
  doc.setFillColor(alR, alG, alB);
  doc.circle(x5 + 2, cy, 1.3, 'F');
  doc.text('Hidup', x5 + 5, cy + 1);

  // 6. Wafat
  const x6 = x + itemW * 5 + 2;
  const [dcR, dcG, dcB] = parseHexRgb(palette.deceasedDotFill);
  const [dcsR, dcsG, dcsB] = parseHexRgb(palette.deceasedDotStroke);
  doc.setFillColor(dcR, dcG, dcB);
  doc.setDrawColor(dcsR, dcsG, dcsB);
  doc.setLineWidth(0.35);
  doc.circle(x6 + 2, cy, 1.3, 'FD');
  doc.text('Wafat (Alm./Almh.)', x6 + 5, cy + 1);
}

function renderCoverPage(
  doc: jsPDF,
  pagination: PosterPaginationResult,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  printDateLabel: string,
  stats?: ExportSummaryStats,
): void {
  const w = pagination.paperWidthMm;
  const h = pagination.paperHeightMm;
  const physical = getPosterPhysicalDimensions(
    1,
    1,
    pagination.effectiveScale,
  );
  void physical;

  const [bgR, bgG, bgB] = parseHexRgb(palette.backgroundColor);
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(0, 0, w, h, 'F');

  // Bingkai ganda ornamen
  const inset = 12;
  const [acR, acG, acB] = parseHexRgb(palette.cardAccentMale);
  const [bdR, bdG, bdB] = parseHexRgb(palette.unionStroke);
  doc.setDrawColor(acR, acG, acB);
  doc.setLineWidth(0.6);
  doc.rect(inset, inset, w - inset * 2, h - inset * 2, 'S');
  doc.setDrawColor(bdR, bdG, bdB);
  doc.setLineWidth(0.25);
  doc.rect(inset + 2.5, inset + 2.5, w - (inset + 2.5) * 2, h - (inset + 2.5) * 2, 'S');

  const centerX = w / 2;
  let cursorY = Math.max(30, h * 0.16);

  // Badge dokumen
  const [badgeBgR, badgeBgG, badgeBgB] = parseHexRgb(palette.continuationBg);
  const [badgeTxR, badgeTxG, badgeTxB] = parseHexRgb(palette.continuationText);
  doc.setFillColor(badgeBgR, badgeBgG, badgeBgB);
  doc.setDrawColor(bdR, bdG, bdB);
  doc.setLineWidth(0.3);
  doc.roundedRect(centerX - 34, cursorY - 6, 68, 8.5, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(badgeTxR, badgeTxG, badgeTxB);
  doc.text('SILSILAH KELUARGA BESAR', centerX, cursorY - 0.5, { align: 'center' });

  cursorY += 16;
  const [txR, txG, txB] = parseHexRgb(palette.textPrimary);
  const [subR, subG, subB] = parseHexRgb(palette.textSecondary);
  const [mutR, mutG, mutB] = parseHexRgb(palette.textMuted);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(txR, txG, txB);
  const titleLines = doc.splitTextToSize(
    sanitizePdfText(settings.meta.title || 'Silsilah Keluarga'),
    w - 48,
  );
  doc.text(titleLines, centerX, cursorY, { align: 'center' });
  cursorY += titleLines.length * 9.5 + 3;

  if (settings.meta.subtitle?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(subR, subG, subB);
    const subLines = doc.splitTextToSize(
      sanitizePdfText(settings.meta.subtitle),
      w - 54,
    );
    doc.text(subLines, centerX, cursorY, { align: 'center' });
    cursorY += subLines.length * 6 + 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(mutR, mutG, mutB);
  doc.text(
    `Mode Poster Sambung (${pagination.cols} x ${pagination.rows} = ${pagination.totalTiles} lembar ${settings.paper.sizeId})  •  Dicetak: ${printDateLabel}`,
    centerX,
    cursorY + 2,
    { align: 'center' },
  );

  cursorY += 14;

  // Kotak statistik cakupan
  const boxW = Math.min(180, w - 48);
  const boxX = centerX - boxW / 2;
  const boxH = 26;
  const [cardR, cardG, cardB] = parseHexRgb(palette.cardBloodBg);
  const [cardBdR, cardBdG, cardBdB] = parseHexRgb(palette.cardBorder);

  doc.setFillColor(cardR, cardG, cardB);
  doc.setDrawColor(cardBdR, cardBdG, cardBdB);
  doc.setLineWidth(0.35);
  doc.roundedRect(boxX, cursorY, boxW, boxH, 3, 3, 'FD');

  const statItems: Array<{ label: string; value: string }> = [
    {
      label: 'Anggota Tercakup',
      value: stats ? `${stats.personCount} orang` : '-',
    },
    {
      label: 'Ikatan Pernikahan',
      value: stats ? `${stats.unionCount} pasangan` : '-',
    },
    {
      label: 'Rentang Generasi',
      value: stats ? `G${stats.minGeneration} - G${stats.maxGeneration}` : '-',
    },
    {
      label: 'Jumlah Lembar',
      value: `${pagination.totalTiles} hal. (${pagination.cols}x${pagination.rows})`,
    },
  ];

  const colW = boxW / statItems.length;
  statItems.forEach((item, idx) => {
    const cx = boxX + colW * idx + colW / 2;
    if (idx > 0) {
      doc.setDrawColor(cardBdR, cardBdG, cardBdB);
      doc.setLineWidth(0.2);
      doc.line(boxX + colW * idx, cursorY + 4, boxX + colW * idx, cursorY + boxH - 4);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(txR, txG, txB);
    doc.text(item.value, cx, cursorY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(mutR, mutG, mutB);
    doc.text(item.label, cx, cursorY + 19, { align: 'center' });
  });

  // Legenda simbol lengkap di bagian bawah sampul
  const legendW = Math.min(230, w - 36);
  const legendX = centerX - legendW / 2;
  const legendY = h - 38;
  drawLegendStrip(doc, legendX, legendY, legendW, 14, palette);
}

function renderAssemblyMapPage(
  doc: jsPDF,
  scene: ExportScene,
  pagination: PosterPaginationResult,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  printDateLabel: string,
): void {
  const w = pagination.paperWidthMm;
  const h = pagination.paperHeightMm;
  const margin = 12;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, 'F');

  const [txR, txG, txB] = parseHexRgb(palette.textPrimary);
  const [subR, subG, subB] = parseHexRgb(palette.textSecondary);
  const [acR, acG, acB] = parseHexRgb(palette.cardAccentMale);

  const physical = getPosterPhysicalDimensions(
    scene.width,
    scene.height,
    pagination.effectiveScale,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(txR, txG, txB);
  doc.text('PETA SUSUNAN POSTER', margin, margin + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(subR, subG, subB);
  doc.text(
    sanitizePdfText(
      `${settings.meta.title}  •  Ukuran Poster: ${physical.posterWidthCm.toFixed(1)} x ${physical.posterHeightCm.toFixed(1)} cm  •  Grid ${pagination.cols} kolom x ${pagination.rows} baris (${pagination.totalTiles} lembar)`,
    ),
    margin,
    margin + 11,
  );

  // Kotak instruksi overlap lem
  const [infoBgR, infoBgG, infoBgB] = parseHexRgb(palette.continuationBg);
  const [infoBdR, infoBdG, infoBdB] = parseHexRgb(palette.continuationBorder);
  doc.setFillColor(infoBgR, infoBgG, infoBgB);
  doc.setDrawColor(infoBdR, infoBdG, infoBdB);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, margin + 14, w - margin * 2, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(acR, acG, acB);
  doc.text(
    `Overlap lem: ${settings.paper.overlapMm} mm  |  Susun berurutan dari kiri ke kanan (A1, A2...) dan atas ke bawah (A, B...). Potong tepi luar tanda potong sebelum menempel.`,
    margin + 3,
    margin + 20.3,
  );

  // Area miniatur vektor
  const topY = margin + 28;
  const legendH = 13;
  const bottomReserve = legendH + margin + 6;
  const availW = w - margin * 2;
  const availH = Math.max(40, h - topY - bottomReserve);

  const totalSceneW = Math.max(1, scene.width);
  const totalSceneH = Math.max(1, scene.height);
  const miniScale = Math.min(availW / totalSceneW, availH / totalSceneH);
  const miniW = totalSceneW * miniScale;
  const miniH = totalSceneH * miniScale;
  const miniX = margin + (availW - miniW) / 2;
  const miniY = topY + (availH - miniH) / 2;

  // Latar belakang miniatur bagan
  const [sbgR, sbgG, sbgB] = parseHexRgb(scene.backgroundColor);
  doc.setFillColor(sbgR, sbgG, sbgB);
  doc.setDrawColor(190, 185, 178);
  doc.setLineWidth(0.25);
  doc.rect(miniX, miniY, miniW, miniH, 'FD');

  // Render miniatur vektor (skip teks agar ringan & tidak berantakan pada skala kecil)
  doc.saveGraphicsState();
  doc.rect(miniX, miniY, miniW, miniH, null);
  doc.clip();
  doc.discardPath();
  renderScenePrimitivesInBox(
    doc,
    scene.primitives,
    miniX,
    miniY,
    0,
    0,
    miniScale,
    { skipText: true, skipImages: true },
  );
  doc.restoreGraphicsState();

  // Overlay grid tile A1, A2, B1...
  for (const tile of pagination.tiles) {
    const gx = miniX + tile.coreSceneRect.x * miniScale;
    const gy = miniY + tile.coreSceneRect.y * miniScale;
    const gw = Math.min(
      miniX + miniW - gx,
      tile.coreSceneRect.width * miniScale,
    );
    const gh = Math.min(
      miniY + miniH - gy,
      tile.coreSceneRect.height * miniScale,
    );
    if (gw <= 0 || gh <= 0) continue;

    doc.setDrawColor(acR, acG, acB);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([1.5, 1], 0);
    doc.rect(gx, gy, gw, gh, 'S');
    doc.setLineDashPattern([], 0);

    // Lencana label tile di tengah sel grid
    const badgeW = Math.min(gw * 0.7, 13);
    const badgeH = Math.min(gh * 0.5, 6);
    const cx = gx + gw / 2;
    const cy = gy + gh / 2;
    if (badgeW >= 4 && badgeH >= 3) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(acR, acG, acB);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx - badgeW / 2, cy - badgeH / 2, badgeW, badgeH, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(9.5, Math.max(5.5, badgeH * 1.4)));
      doc.setTextColor(acR, acG, acB);
      doc.text(tile.coordLabel, cx, cy + badgeH * 0.25, { align: 'center' });
    }
  }

  // Legenda & tanggal cetak
  drawLegendStrip(doc, margin, h - margin - legendH, w - margin * 2, legendH, palette);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 102, 95);
  doc.text(`Dicetak: ${printDateLabel}`, w - margin, h - margin + 3.5, {
    align: 'right',
  });
}

function drawCutMarks(
  doc: jsPDF,
  marginX: number,
  marginY: number,
  printW: number,
  printH: number,
  paperW: number,
  paperH: number,
): void {
  const len = Math.max(2, Math.min(4.5, marginX - 1, marginY - 1));
  const gap = 0.8;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.25);

  const x0 = marginX;
  const x1 = marginX + printW;
  const y0 = marginY;
  const y1 = marginY + printH;

  // Top-left
  doc.line(Math.max(0.5, x0 - gap - len), y0, Math.max(0.5, x0 - gap), y0);
  doc.line(x0, Math.max(0.5, y0 - gap - len), x0, Math.max(0.5, y0 - gap));

  // Top-right
  doc.line(Math.min(paperW - 0.5, x1 + gap), y0, Math.min(paperW - 0.5, x1 + gap + len), y0);
  doc.line(x1, Math.max(0.5, y0 - gap - len), x1, Math.max(0.5, y0 - gap));

  // Bottom-left
  doc.line(Math.max(0.5, x0 - gap - len), y1, Math.max(0.5, x0 - gap), y1);
  doc.line(x0, Math.min(paperH - 0.5, y1 + gap), x0, Math.min(paperH - 0.5, y1 + gap + len));

  // Bottom-right
  doc.line(Math.min(paperW - 0.5, x1 + gap), y1, Math.min(paperW - 0.5, x1 + gap + len), y1);
  doc.line(x1, Math.min(paperH - 0.5, y1 + gap), x1, Math.min(paperH - 0.5, y1 + gap + len));
}

function drawNeighborTriangle(
  doc: jsPDF,
  direction: 'up' | 'right' | 'down' | 'left',
  cx: number,
  cy: number,
  size: number,
): void {
  const half = size / 2;
  if (direction === 'up') {
    doc.triangle(cx, cy - half, cx - half, cy + half, cx + half, cy + half, 'F');
  } else if (direction === 'down') {
    doc.triangle(cx, cy + half, cx - half, cy - half, cx + half, cy - half, 'F');
  } else if (direction === 'right') {
    doc.triangle(cx + half, cy, cx - half, cy - half, cx - half, cy + half, 'F');
  } else {
    doc.triangle(cx - half, cy, cx + half, cy - half, cx + half, cy + half, 'F');
  }
}

function drawTileLabelsAndArrows(
  doc: jsPDF,
  tile: PosterTile,
  pagination: PosterPaginationResult,
  marginX: number,
  marginY: number,
  palette: PrintThemeTokens,
): void {
  const [acR, acG, acB] = parseHexRgb(palette.cardAccentMale);
  const [bgR, bgG, bgB] = parseHexRgb(palette.continuationBg);

  // Lencana koordinat utama di kiri-atas margin strip
  const badgeY = Math.max(1.2, marginY - 5.2);
  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(acR, acG, acB);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, badgeY, 13, 4.4, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(acR, acG, acB);
  doc.text(tile.coordLabel, marginX + 6.5, badgeY + 3.1, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(90, 80, 74);
  doc.setFillColor(90, 80, 74);

  const printW = pagination.printableWidthMm;
  const printH = pagination.printableHeightMm;

  // Panah sambung atas
  if (tile.neighborLabels.top) {
    const cx = marginX + printW / 2;
    const cy = Math.max(2.5, marginY - 2.6);
    drawNeighborTriangle(doc, 'up', cx - 4.5, cy - 0.6, 1.8);
    doc.text(tile.neighborLabels.top, cx - 2.5, cy + 0.5, { align: 'left' });
  }

  // Panah sambung bawah
  if (tile.neighborLabels.bottom) {
    const cx = marginX + printW / 2;
    const cy = Math.min(
      pagination.paperHeightMm - 2.2,
      marginY + printH + 3.2,
    );
    drawNeighborTriangle(doc, 'down', cx - 4.5, cy - 0.6, 1.8);
    doc.text(tile.neighborLabels.bottom, cx - 2.5, cy + 0.5, { align: 'left' });
  }

  // Panah sambung kanan
  if (tile.neighborLabels.right) {
    const rx = Math.min(pagination.paperWidthMm - 2, marginX + printW + 3.5);
    const ry = marginY + printH / 2;
    drawNeighborTriangle(doc, 'right', rx, ry - 3, 1.8);
    doc.text(tile.neighborLabels.right, rx, ry + 1.5, { align: 'center' });
  }

  // Panah sambung kiri
  if (tile.neighborLabels.left) {
    const lx = Math.max(2, marginX - 3.5);
    const ly = marginY + printH / 2;
    drawNeighborTriangle(doc, 'left', lx, ly - 3, 1.8);
    doc.text(tile.neighborLabels.left, lx, ly + 1.5, { align: 'center' });
  }
}

function renderTilePage(
  doc: jsPDF,
  scene: ExportScene,
  tile: PosterTile,
  pagination: PosterPaginationResult,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  pdfPageNum: number,
  totalPdfPages: number,
  printDateLabel: string,
): void {
  const paperW = pagination.paperWidthMm;
  const paperH = pagination.paperHeightMm;
  const printW = pagination.printableWidthMm;
  const printH = pagination.printableHeightMm;
  const marginX = Math.max(0, (paperW - printW) / 2);
  const marginY = Math.max(0, (paperH - printH) / 2);
  const scale = pagination.effectiveScale;

  // Halaman kertas putih bersih, area cetak diisi warna latar tema
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, paperW, paperH, 'F');

  const [bgR, bgG, bgB] = parseHexRgb(scene.backgroundColor);
  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(marginX, marginY, printW, printH, 'F');

  // Klip ke area cetak agar tepi margin dan tanda potong tetap bersih
  doc.saveGraphicsState();
  doc.rect(marginX, marginY, printW, printH, null);
  doc.clip();
  doc.discardPath();

  const visiblePrimitives = scene.primitives.filter((prim) =>
    primitiveIntersectsCrop(prim, tile.sceneCropRect),
  );

  renderScenePrimitivesInBox(
    doc,
    visiblePrimitives,
    marginX,
    marginY,
    tile.sceneCropRect.x,
    tile.sceneCropRect.y,
    scale,
  );

  // Garis panduan overlap lem putus-putus di sisi kanan / bawah bila bersambung
  if (settings.paper.showCutMarks && settings.paper.overlapMm > 0) {
    const overlapX = Math.min(settings.paper.overlapMm, Math.max(0, printW - 1));
    const overlapY = Math.min(settings.paper.overlapMm, Math.max(0, printH - 1));
    doc.setDrawColor(145, 130, 120);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);

    if (tile.neighborLabels.right && overlapX > 0) {
      const gx = marginX + printW - overlapX;
      doc.line(gx, marginY, gx, marginY + printH);
    }
    if (tile.neighborLabels.bottom && overlapY > 0) {
      const gy = marginY + printH - overlapY;
      doc.line(marginX, gy, marginX + printW, gy);
    }

    doc.setLineDashPattern([], 0);
  }

  doc.restoreGraphicsState();

  // Bingkai tipis batas area cetak
  doc.setDrawColor(215, 208, 198);
  doc.setLineWidth(0.15);
  doc.rect(marginX, marginY, printW, printH, 'S');

  if (settings.paper.showCutMarks) {
    drawCutMarks(doc, marginX, marginY, printW, printH, paperW, paperH);
  }

  if (settings.paper.showTileLabels) {
    drawTileLabelsAndArrows(doc, tile, pagination, marginX, marginY, palette);
  }

  if (settings.meta.includeFooter) {
    const footerY = Math.min(paperH - 2, marginY + printH + Math.max(3.5, marginY * 0.55));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 92, 85);
    doc.text(
      sanitizePdfText(`${settings.meta.title}  •  Tile ${tile.coordLabel}`),
      marginX,
      footerY,
      { align: 'left' },
    );
    doc.text(
      `Hal. ${pdfPageNum}/${totalPdfPages}  •  ${printDateLabel}`,
      marginX + printW,
      footerY,
      { align: 'right' },
    );
  }
}

/**
 * Menghasilkan dokumen PDF vektor multi-halaman untuk Mode Poster Tiling,
 * lengkap dengan halaman sampul opsional, peta susunan poster, tanda potong,
 * panduan overlap lem, panah sambungan tetangga, dan footer.
 */
export async function generatePosterPdfBlob(
  scene: ExportScene,
  pagination: PosterPaginationResult,
  settings: ExportSettings,
  options?: ExportExecutionOptions & { stats?: ExportSummaryStats },
): Promise<Blob> {
  checkAborted(options?.signal);

  const hasCover = Boolean(settings.meta.includeCoverPage);
  const hasAssemblyMap = Boolean(settings.paper.includeAssemblyMap);
  const totalPages =
    (hasCover ? 1 : 0) + (hasAssemblyMap ? 1 : 0) + pagination.tiles.length;

  options?.onProgress?.({
    phase: 'preparing',
    current: 0,
    total: Math.max(1, totalPages),
    message: 'Menyiapkan dokumen PDF poster...',
  });

  const { jsPDF } = await import('jspdf');
  checkAborted(options?.signal);

  const orientation =
    pagination.paperWidthMm > pagination.paperHeightMm
      ? 'landscape'
      : 'portrait';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [pagination.paperWidthMm, pagination.paperHeightMm],
    compress: true,
  });

  doc.setProperties({
    title: settings.meta.title || 'Silsilah Bani Sukar',
    subject: settings.meta.subtitle || 'Poster Silsilah Keluarga',
    creator: 'Aplikasi Silsilah Trah Bani Sukar',
  });

  const palette = getPrintThemePalette(settings.theme);
  const printDateLabel = formatDateId(new Date().toISOString());

  let renderedPages = 0;

  if (hasCover) {
    renderCoverPage(
      doc,
      pagination,
      settings,
      palette,
      printDateLabel,
      options?.stats,
    );
    renderedPages += 1;
    options?.onProgress?.({
      phase: 'rendering',
      current: renderedPages,
      total: totalPages,
      message: 'Merender halaman sampul...',
    });
  }

  if (hasAssemblyMap) {
    checkAborted(options?.signal);
    if (renderedPages > 0) {
      doc.addPage(
        [pagination.paperWidthMm, pagination.paperHeightMm],
        orientation,
      );
    }
    renderAssemblyMapPage(
      doc,
      scene,
      pagination,
      settings,
      palette,
      printDateLabel,
    );
    renderedPages += 1;
    options?.onProgress?.({
      phase: 'rendering',
      current: renderedPages,
      total: totalPages,
      message: 'Merender peta susunan poster...',
    });
  }

  for (const tile of pagination.tiles) {
    checkAborted(options?.signal);
    if (renderedPages > 0) {
      doc.addPage(
        [pagination.paperWidthMm, pagination.paperHeightMm],
        orientation,
      );
    }
    renderedPages += 1;
    renderTilePage(
      doc,
      scene,
      tile,
      pagination,
      settings,
      palette,
      renderedPages,
      totalPages,
      printDateLabel,
    );
    options?.onProgress?.({
      phase: 'rendering',
      current: renderedPages,
      total: totalPages,
      message: `Merender lembar ${tile.coordLabel} (${renderedPages}/${totalPages})...`,
    });
  }

  checkAborted(options?.signal);
  options?.onProgress?.({
    phase: 'done',
    current: totalPages,
    total: totalPages,
    message: 'PDF poster siap diunduh.',
  });

  return doc.output('blob');
}
