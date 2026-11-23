import type { jsPDF } from 'jspdf';
import { getGeneration } from '@/features/family/graph';
import { formatDateId } from '@/lib/format';
import { MM_TO_PT } from './constants';
import { computeBookPagination } from './paginator-book';
import { resolvePaperDimensionsMm } from './paginator-poster';
import { renderPdfCoverPage } from './pdf-cover';
import { filterGraphByScope } from './scope';
import { getPrintThemePalette, type PrintThemeTokens } from './theme';
import type {
  BookPageDescriptor,
  BookPaginationResult,
  ExportExecutionOptions,
  ExportSettings,
  FamilyGraph,
  ScenePrimitive,
} from './types';

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Ekspor PDF buku dibatalkan', 'AbortError');
  }
}

/**
 * Menormalkan karakter Unicode non-WinAnsi agar font bawaan PDF (Helvetica)
 * tetap terbaca bersih tanpa simbol rusak.
 */
function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=');
}

function parseDashArray(raw: string | undefined, scale: number): number[] {
  if (!raw) return [];
  return raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.max(0.25, n * scale));
}

function inferImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  const lower = dataUrl.slice(0, 48).toLowerCase();
  if (lower.includes('image/jpeg') || lower.includes('image/jpg')) return 'JPEG';
  if (lower.includes('image/webp')) return 'WEBP';
  return 'PNG';
}

function drawSvgPathPrimitive(
  doc: jsPDF,
  d: string,
  offsetX: number,
  offsetY: number,
  scale: number,
  style: {
    stroke?: string;
    strokeWidth: number;
    strokeDasharray?: string;
    fill?: string;
  },
): void {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens || tokens.length === 0) return;

  const hasFill = Boolean(style.fill && style.fill !== 'none');
  const hasStroke = Boolean(style.stroke && style.stroke !== 'none');
  if (!hasFill && !hasStroke) return;

  if (hasFill && style.fill) {
    doc.setFillColor(style.fill);
  }
  if (hasStroke && style.stroke) {
    doc.setDrawColor(style.stroke);
    doc.setLineWidth(Math.max(0.12, style.strokeWidth * scale));
    doc.setLineCap('round');
    doc.setLineJoin('round');
    const dash = parseDashArray(style.strokeDasharray, scale);
    doc.setLineDashPattern(dash, 0);
  }

  let idx = 0;
  let cmd = '';
  let curX = 0;
  let curY = 0;

  const readNum = (): number => {
    const val = Number(tokens[idx]);
    idx += 1;
    return Number.isFinite(val) ? val : 0;
  };
  const mapX = (sx: number) => offsetX + sx * scale;
  const mapY = (sy: number) => offsetY + sy * scale;

  while (idx < tokens.length) {
    const token = tokens[idx];
    if (/^[a-zA-Z]$/.test(token)) {
      cmd = token;
      idx += 1;
      if (cmd === 'Z' || cmd === 'z') {
        doc.close();
      }
      continue;
    }

    if (cmd === 'M' || cmd === 'm') {
      const rawX = readNum();
      const rawY = readNum();
      curX = cmd === 'm' ? curX + rawX : rawX;
      curY = cmd === 'm' ? curY + rawY : rawY;
      doc.moveTo(mapX(curX), mapY(curY));
      cmd = cmd === 'm' ? 'l' : 'L';
    } else if (cmd === 'L' || cmd === 'l') {
      const rawX = readNum();
      const rawY = readNum();
      curX = cmd === 'l' ? curX + rawX : rawX;
      curY = cmd === 'l' ? curY + rawY : rawY;
      doc.lineTo(mapX(curX), mapY(curY));
    } else if (cmd === 'C' || cmd === 'c') {
      const rx1 = readNum();
      const ry1 = readNum();
      const rx2 = readNum();
      const ry2 = readNum();
      const rx3 = readNum();
      const ry3 = readNum();
      const x1 = cmd === 'c' ? curX + rx1 : rx1;
      const y1 = cmd === 'c' ? curY + ry1 : ry1;
      const x2 = cmd === 'c' ? curX + rx2 : rx2;
      const y2 = cmd === 'c' ? curY + ry2 : ry2;
      const x3 = cmd === 'c' ? curX + rx3 : rx3;
      const y3 = cmd === 'c' ? curY + ry3 : ry3;
      doc.curveTo(mapX(x1), mapY(y1), mapX(x2), mapY(y2), mapX(x3), mapY(y3));
      curX = x3;
      curY = y3;
    } else {
      idx += 1;
    }
  }

  if (hasFill && hasStroke) {
    doc.fillStroke();
  } else if (hasFill) {
    doc.fill();
  } else {
    doc.stroke();
  }

  if (hasStroke) {
    doc.setLineDashPattern([], 0);
  }
}

function drawScenePrimitive(
  doc: jsPDF,
  prim: ScenePrimitive,
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  switch (prim.kind) {
    case 'rect': {
      const x = offsetX + prim.x * scale;
      const y = offsetY + prim.y * scale;
      const w = prim.width * scale;
      const h = prim.height * scale;
      const hasFill = Boolean(prim.fill && prim.fill !== 'none');
      const hasStroke = Boolean(prim.stroke && prim.stroke !== 'none');
      if (!hasFill && !hasStroke) return;

      const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
      if (hasFill) {
        doc.setFillColor(prim.fill);
      }
      if (hasStroke && prim.stroke) {
        doc.setDrawColor(prim.stroke);
        doc.setLineWidth(Math.max(0.12, (prim.strokeWidth ?? 1) * scale));
        doc.setLineDashPattern(parseDashArray(prim.strokeDasharray, scale), 0);
      }

      const r = (prim.rx ?? 0) * scale;
      if (r > 0) {
        doc.roundedRect(x, y, w, h, r, r, style);
      } else {
        doc.rect(x, y, w, h, style);
      }

      if (hasStroke) {
        doc.setLineDashPattern([], 0);
      }
      return;
    }

    case 'circle': {
      const cx = offsetX + prim.cx * scale;
      const cy = offsetY + prim.cy * scale;
      const r = prim.r * scale;
      const hasFill = Boolean(prim.fill && prim.fill !== 'none');
      const hasStroke = Boolean(prim.stroke && prim.stroke !== 'none');
      if (!hasFill && !hasStroke) return;

      const style = hasFill && hasStroke ? 'FD' : hasFill ? 'F' : 'S';
      if (hasFill) {
        doc.setFillColor(prim.fill);
      }
      if (hasStroke && prim.stroke) {
        doc.setDrawColor(prim.stroke);
        doc.setLineWidth(Math.max(0.12, (prim.strokeWidth ?? 1) * scale));
      }
      doc.circle(cx, cy, r, style);
      return;
    }

    case 'path': {
      drawSvgPathPrimitive(doc, prim.d, offsetX, offsetY, scale, {
        stroke: prim.stroke,
        strokeWidth: prim.strokeWidth,
        strokeDasharray: prim.strokeDasharray,
        fill: prim.fill,
      });
      return;
    }

    case 'text': {
      const tx = offsetX + prim.x * scale;
      const ty = offsetY + prim.y * scale;
      const fontPt = Math.max(1.5, prim.fontSize * scale * MM_TO_PT);
      const fontStyle =
        prim.fontWeight === 'bold' || prim.fontWeight === 'semibold'
          ? 'bold'
          : 'normal';
      const align =
        prim.anchor === 'middle'
          ? 'center'
          : prim.anchor === 'end'
            ? 'right'
            : 'left';

      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontPt);
      doc.setTextColor(prim.fill);
      doc.text(sanitizePdfText(prim.text), tx, ty, { align });
      return;
    }

    case 'image': {
      if (!prim.href || !prim.href.startsWith('data:image/')) {
        return;
      }
      const ix = offsetX + prim.x * scale;
      const iy = offsetY + prim.y * scale;
      const iw = prim.width * scale;
      const ih = prim.height * scale;

      try {
        doc.saveGraphicsState();
        if (prim.clipCircle) {
          const cx = ix + iw / 2;
          const cy = iy + ih / 2;
          const r = Math.min(iw, ih) / 2;
          doc.circle(cx, cy, r, null);
          doc.clip();
          doc.discardPath();
        }
        doc.addImage(prim.href, inferImageFormat(prim.href), ix, iy, iw, ih);
        doc.restoreGraphicsState();
      } catch {
        // Fallback: underlying avatar circle + initials already exist in scene
        try {
          doc.restoreGraphicsState();
        } catch {
          // ignore
        }
      }
      return;
    }
  }
}

function renderBookPageHeader(
  doc: jsPDF,
  page: BookPageDescriptor,
  totalPages: number,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  x: number,
  y: number,
  width: number,
): number {
  const headerH = 11.5;
  const badgeText = `Hal. ${page.pageNumber} / ${totalPages}`;
  const badgeW = 24;

  doc.setFillColor(palette.badgeBg);
  doc.setDrawColor(palette.cardBorder);
  doc.setLineWidth(0.25);
  doc.roundedRect(x + width - badgeW, y, badgeW, 6.2, 1.8, 1.8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(palette.badgeText);
  doc.text(badgeText, x + width - badgeW / 2, y + 4.3, { align: 'center' });

  const textMaxW = Math.max(40, width - badgeW - 6);

  if (page.parentPageNumber !== null) {
    const breadcrumb =
      page.lineageBreadcrumb.length > 0
        ? page.lineageBreadcrumb.join(' › ')
        : page.rootPersonName;
    const headerTitle = sanitizePdfText(`Lanjutan dari hal. ${page.parentPageNumber}`);
    const pathText = sanitizePdfText(`Jalur: ${breadcrumb}`);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(palette.textPrimary);
    doc.text(headerTitle, x, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(palette.textSecondary);
    const fittedPath = doc.splitTextToSize(pathText, textMaxW)[0] ?? pathText;
    doc.text(fittedPath, x, y + 8.6);
  } else {
    const title = sanitizePdfText(
      settings.meta.title?.trim() || 'Silsilah Trah Bani Sukar & Sadirah',
    );
    const subtitle = sanitizePdfText(
      page.pageNumber === 1
        ? settings.meta.subtitle?.trim() || page.rootPersonName
        : `Cabang: ${page.rootPersonName}`,
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(palette.textPrimary);
    const fittedTitle = doc.splitTextToSize(title, textMaxW)[0] ?? title;
    doc.text(fittedTitle, x, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(palette.textSecondary);
    const fittedSub = doc.splitTextToSize(subtitle, textMaxW)[0] ?? subtitle;
    doc.text(fittedSub, x, y + 8.6);
  }

  doc.setDrawColor(palette.legendBorder);
  doc.setLineWidth(0.28);
  doc.line(x, y + headerH - 0.8, x + width, y + headerH - 0.8);

  return headerH;
}

function renderBookPageLegend(
  doc: jsPDF,
  palette: PrintThemeTokens,
  x: number,
  y: number,
  width: number,
): void {
  const h = 8.5;
  doc.setDrawColor(palette.legendBorder);
  doc.setLineWidth(0.22);
  doc.line(x, y, x + width, y);

  const cy = y + h / 2 + 0.4;
  const textY = cy + 1;
  let cx = x;
  const step = width / 6;

  // 1. Nasab
  doc.setFillColor(palette.cardBloodBg);
  doc.setDrawColor(palette.cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(cx, cy - 1.7, 4.8, 3.4, 0.7, 0.7, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(palette.textSecondary);
  doc.text('Nasab', cx + 6.2, textY);
  cx += step;

  // 2. Menantu
  doc.setFillColor(palette.cardSpouseBg);
  doc.setDrawColor(palette.cardSpouseBorder);
  doc.setLineDashPattern([1, 0.7], 0);
  doc.roundedRect(cx, cy - 1.7, 4.8, 3.4, 0.7, 0.7, 'FD');
  doc.setLineDashPattern([], 0);
  doc.text('Menantu', cx + 6.2, textY);
  cx += step;

  // 3. Menikah
  doc.setDrawColor(palette.edgeMarried);
  doc.setLineWidth(0.45);
  doc.line(cx, cy, cx + 5.2, cy);
  doc.text('Menikah', cx + 6.5, textY);
  cx += step;

  // 4. Cerai
  doc.setDrawColor(palette.edgeDivorced);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([1.2, 0.8], 0);
  doc.line(cx, cy + 0.4, cx + 5.2, cy + 0.4);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(palette.edgeDivorced);
  doc.text('//', cx + 2.6, cy - 0.6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(palette.textSecondary);
  doc.text('Cerai (//)', cx + 6.5, textY);
  cx += step;

  // 5. Hidup
  doc.setFillColor(palette.aliveDotFill);
  doc.circle(cx + 2, cy, 1.3, 'F');
  doc.text('Hidup', cx + 4.8, textY);
  cx += step;

  // 6. Wafat
  doc.setFillColor(palette.deceasedDotFill);
  doc.setDrawColor(palette.deceasedDotStroke);
  doc.setLineWidth(0.3);
  doc.circle(cx + 2, cy, 1.3, 'FD');
  doc.text('Wafat (Alm./Almh.)', cx + 4.8, textY);
}

function renderBookPageFooter(
  doc: jsPDF,
  page: BookPageDescriptor,
  totalPages: number,
  settings: ExportSettings,
  palette: PrintThemeTokens,
  printDateId: string,
  x: number,
  y: number,
  width: number,
): void {
  doc.setDrawColor(palette.legendBorder);
  doc.setLineWidth(0.2);
  doc.line(x, y, x + width, y);

  const scopeLabel = sanitizePdfText(
    settings.meta.subtitle?.trim() || settings.meta.title?.trim() || 'Silsilah Bani Sukar',
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(palette.textMuted);
  doc.text(scopeLabel, x, y + 4);
  doc.text(`Dicetak ${printDateId}`, x + width / 2, y + 4, { align: 'center' });
  doc.text(`Halaman ${page.pageNumber} dari ${totalPages}`, x + width, y + 4, {
    align: 'right',
  });
}

function computeCoverStats(
  graph: FamilyGraph,
  settings: ExportSettings,
  totalPages: number,
): {
  totalPersons: number;
  totalGenerations: number;
  totalUnions: number;
  totalPages: number;
  scopeLabel: string;
} {
  const scopedGraph = filterGraphByScope(graph, settings.scope);
  const gens = new Set<number>();
  for (const person of scopedGraph.persons.values()) {
    gens.add(getGeneration(graph, person.id));
  }

  return {
    totalPersons: scopedGraph.persons.size,
    totalGenerations: gens.size,
    totalUnions: scopedGraph.unions.size,
    totalPages,
    scopeLabel: settings.meta.subtitle?.trim() || 'Seluruh Bagan',
  };
}

/**
 * Menghasilkan Blob PDF vektor multi-halaman untuk Mode Buku Silsilah
 * (opsional sampul + halaman silsilah dengan breadcrumb jalur & rujukan `→ hal. X`).
 */
export async function generateBookPdfBlob(
  graph: FamilyGraph,
  settings: ExportSettings,
  options?: ExportExecutionOptions & {
    photoMap?: Map<string, string>;
    bookPagination?: BookPaginationResult;
  },
): Promise<Blob> {
  throwIfAborted(options?.signal);

  options?.onProgress?.({
    phase: 'preparing',
    current: 0,
    total: 1,
    message: 'Menyiapkan paginasi buku silsilah…',
  });

  const bookPagination =
    options?.bookPagination ??
    computeBookPagination(graph, settings, { photoMap: options?.photoMap });

  throwIfAborted(options?.signal);

  const { jsPDF } = await import('jspdf');
  const { paperWidthMm, paperHeightMm } = resolvePaperDimensionsMm(settings.paper);
  const orientation = paperWidthMm > paperHeightMm ? 'landscape' : 'portrait';

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: [paperWidthMm, paperHeightMm],
    compress: true,
  });

  const palette = getPrintThemePalette(settings.theme);
  const rawMargin = Number.isFinite(settings.paper.marginMm)
    ? Math.max(0, settings.paper.marginMm)
    : 8;
  const maxAllowedMargin = Math.min(paperWidthMm, paperHeightMm) / 2 - 0.5;
  const marginMm = Math.min(rawMargin, Math.max(0, maxAllowedMargin));
  const printableW = Math.max(10, paperWidthMm - 2 * marginMm);
  const printableH = Math.max(10, paperHeightMm - 2 * marginMm);

  const totalWorkSteps =
    (settings.meta.includeCoverPage ? 1 : 0) + Math.max(1, bookPagination.pages.length);
  let completedSteps = 0;

  if (settings.meta.includeCoverPage) {
    throwIfAborted(options?.signal);
    const stats = computeCoverStats(graph, settings, bookPagination.totalPages);
    renderPdfCoverPage(doc, settings, stats);
    completedSteps += 1;
    options?.onProgress?.({
      phase: 'rendering',
      current: completedSteps,
      total: totalWorkSteps,
      message: 'Merender halaman sampul…',
    });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const printDateId = formatDateId(todayIso);

  if (bookPagination.pages.length === 0) {
    if (settings.meta.includeCoverPage) {
      doc.addPage([paperWidthMm, paperHeightMm], orientation);
    }
    doc.setFillColor(palette.backgroundColor);
    doc.rect(0, 0, paperWidthMm, paperHeightMm, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(palette.textSecondary);
    doc.text('Tidak ada anggota dalam cakupan yang dipilih.', paperWidthMm / 2, paperHeightMm / 2, {
      align: 'center',
    });
  } else {
    for (let i = 0; i < bookPagination.pages.length; i++) {
      throwIfAborted(options?.signal);
      const page = bookPagination.pages[i];

      if (settings.meta.includeCoverPage || i > 0) {
        doc.addPage([paperWidthMm, paperHeightMm], orientation);
      }

      doc.setFillColor(palette.backgroundColor);
      doc.rect(0, 0, paperWidthMm, paperHeightMm, 'F');

      const headerH = renderBookPageHeader(
        doc,
        page,
        bookPagination.totalPages,
        settings,
        palette,
        marginMm,
        marginMm,
        printableW,
      );

      const footerH = settings.meta.includeFooter ? 6 : 0;
      const legendH = settings.meta.includeLegend ? 9.5 : 0;

      if (settings.meta.includeLegend) {
        renderBookPageLegend(
          doc,
          palette,
          marginMm,
          paperHeightMm - marginMm - footerH - legendH,
          printableW,
        );
      }

      if (settings.meta.includeFooter) {
        renderBookPageFooter(
          doc,
          page,
          bookPagination.totalPages,
          settings,
          palette,
          printDateId,
          marginMm,
          paperHeightMm - marginMm - footerH,
          printableW,
        );
      }

      const treeBoxX = marginMm;
      const treeBoxY = marginMm + headerH + 2;
      const treeBoxW = printableW;
      const treeBoxH = Math.max(10, printableH - headerH - 2 - legendH - footerH - 1);

      const scale = Math.min(
        treeBoxW / Math.max(1, page.scene.width),
        treeBoxH / Math.max(1, page.scene.height),
      );
      const offsetX = treeBoxX + (treeBoxW - page.scene.width * scale) / 2;
      const offsetY = treeBoxY + (treeBoxH - page.scene.height * scale) / 2;

      for (const prim of page.scene.primitives) {
        drawScenePrimitive(doc, prim, offsetX, offsetY, scale);
      }

      completedSteps += 1;
      options?.onProgress?.({
        phase: 'rendering',
        current: completedSteps,
        total: totalWorkSteps,
        message: `Merender halaman ${page.pageNumber} dari ${bookPagination.totalPages}…`,
      });
    }
  }

  throwIfAborted(options?.signal);
  options?.onProgress?.({
    phase: 'packaging',
    current: totalWorkSteps,
    total: totalWorkSteps,
    message: 'Menyusun berkas PDF buku…',
  });

  const blob = doc.output('blob');

  options?.onProgress?.({
    phase: 'done',
    current: totalWorkSteps,
    total: totalWorkSteps,
    message: 'PDF buku selesai dibuat.',
  });

  return blob;
}
