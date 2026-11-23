import type { jsPDF } from 'jspdf';
import { formatDateId } from '@/lib/format';
import { getPrintThemePalette } from './theme';
import type { ExportSettings } from './types';

export interface PdfCoverStats {
  totalPersons: number;
  totalGenerations: number;
  totalUnions: number;
  totalPages: number;
  scopeLabel: string;
}

function drawCornerAccent(
  doc: jsPDF,
  x: number,
  y: number,
  dx: number,
  dy: number,
  accentColor: string,
): void {
  doc.setDrawColor(accentColor);
  doc.setLineWidth(0.5);
  doc.line(x, y, x + dx * 6, y);
  doc.line(x, y, x, y + dy * 6);
  doc.setFillColor(accentColor);
  doc.circle(x + dx * 2.2, y + dy * 2.2, 0.7, 'F');
}

/**
 * Merender halaman sampul dokumen PDF vektor yang elegan sesuai tema cetak
 * (`color`, `ink-saver`, `monochrome`), lengkap dengan bingkai ornamen ganda,
 * judul/cakupan, ringkasan statistik, legenda simbol lengkap, dan tanggal cetak.
 */
export function renderPdfCoverPage(
  doc: jsPDF,
  settings: ExportSettings,
  stats: PdfCoverStats,
): void {
  const palette = getPrintThemePalette(settings.theme);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const isLandscape = pageW > pageH;
  const centerX = pageW / 2;

  // 1. Background
  doc.setFillColor(palette.backgroundColor);
  doc.rect(0, 0, pageW, pageH, 'F');

  // 2. Double ornamental border frame
  const outerInset = Math.max(8, Math.min(settings.paper.marginMm || 10, 14));
  const innerInset = outerInset + 2.6;
  const frameW = pageW - outerInset * 2;
  const frameH = pageH - outerInset * 2;

  doc.setDrawColor(palette.unionStroke);
  doc.setLineWidth(0.75);
  doc.roundedRect(outerInset, outerInset, frameW, frameH, 3, 3, 'S');

  doc.setDrawColor(palette.cardBorder);
  doc.setLineWidth(0.28);
  doc.roundedRect(
    innerInset,
    innerInset,
    pageW - innerInset * 2,
    pageH - innerInset * 2,
    2,
    2,
    'S',
  );

  // Corner ornaments inside inner frame
  const cornerInset = innerInset + 2.2;
  drawCornerAccent(doc, cornerInset, cornerInset, 1, 1, palette.unionStroke);
  drawCornerAccent(doc, pageW - cornerInset, cornerInset, -1, 1, palette.unionStroke);
  drawCornerAccent(doc, cornerInset, pageH - cornerInset, 1, -1, palette.unionStroke);
  drawCornerAccent(
    doc,
    pageW - cornerInset,
    pageH - cornerInset,
    -1,
    -1,
    palette.unionStroke,
  );

  const contentWidth = Math.min(pageW - (innerInset + 12) * 2, isLandscape ? 236 : 168);
  const contentX = centerX - contentWidth / 2;

  // 3. Crest / Header Badge
  let cursorY = innerInset + (isLandscape ? 12 : 20);
  const badgeW = 68;
  const badgeH = 8;
  doc.setFillColor(palette.badgeBg);
  doc.setDrawColor(palette.unionStroke);
  doc.setLineWidth(0.35);
  doc.roundedRect(centerX - badgeW / 2, cursorY, badgeW, badgeH, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(palette.continuationText);
  doc.text('DOKUMEN SILSILAH KELUARGA', centerX, cursorY + 5.3, { align: 'center' });

  cursorY += badgeH + (isLandscape ? 10 : 14);

  // 4. Title & Subtitle / Scope
  const mainTitle = settings.meta.title?.trim() || 'Silsilah Trah Bani Sukar & Sadirah';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 21 : 22);
  doc.setTextColor(palette.textPrimary);
  const titleLines: string[] = doc.splitTextToSize(mainTitle, contentWidth);
  for (const line of titleLines) {
    doc.text(line, centerX, cursorY, { align: 'center' });
    cursorY += isLandscape ? 8.5 : 9.5;
  }

  const subtitleText =
    settings.meta.subtitle?.trim() || stats.scopeLabel?.trim() || 'Seluruh Bagan';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(palette.textSecondary);
  const subtitleLines: string[] = doc.splitTextToSize(subtitleText, contentWidth);
  for (const line of subtitleLines) {
    doc.text(line, centerX, cursorY, { align: 'center' });
    cursorY += 5.5;
  }

  if (
    stats.scopeLabel?.trim() &&
    settings.meta.subtitle?.trim() &&
    stats.scopeLabel.trim() !== settings.meta.subtitle.trim()
  ) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(palette.textMuted);
    doc.text(`Cakupan: ${stats.scopeLabel.trim()}`, centerX, cursorY + 1, {
      align: 'center',
    });
    cursorY += 6;
  }

  // Ornamental divider rule
  cursorY += 2;
  const ruleHalfW = Math.min(54, contentWidth * 0.35);
  doc.setDrawColor(palette.unionStroke);
  doc.setLineWidth(0.4);
  doc.line(centerX - ruleHalfW, cursorY, centerX - 4, cursorY);
  doc.line(centerX + 4, cursorY, centerX + ruleHalfW, cursorY);
  doc.setFillColor(palette.unionStroke);
  doc.circle(centerX, cursorY, 1.1, 'F');

  cursorY += isLandscape ? 9 : 13;

  // 5. Summary Statistics Box
  const statItems = [
    { label: 'Jumlah Anggota', value: String(stats.totalPersons) },
    { label: 'Rentang Generasi', value: `${stats.totalGenerations} Gen.` },
    { label: 'Ikatan Pernikahan', value: String(stats.totalUnions) },
    { label: 'Jumlah Halaman', value: `${stats.totalPages} Hal.` },
  ];

  const statsBoxH = isLandscape ? 22 : 25;
  doc.setFillColor(palette.cardBloodBg);
  doc.setDrawColor(palette.cardBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(contentX, cursorY, contentWidth, statsBoxH, 2.5, 2.5, 'FD');

  const colW = contentWidth / statItems.length;
  statItems.forEach((item, idx) => {
    const cellCenterX = contentX + colW * idx + colW / 2;
    if (idx > 0) {
      doc.setDrawColor(palette.legendBorder);
      doc.setLineWidth(0.25);
      doc.line(
        contentX + colW * idx,
        cursorY + 4,
        contentX + colW * idx,
        cursorY + statsBoxH - 4,
      );
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isLandscape ? 13 : 14);
    doc.setTextColor(palette.textPrimary);
    doc.text(item.value, cellCenterX, cursorY + statsBoxH * 0.48, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(palette.textMuted);
    doc.text(item.label, cellCenterX, cursorY + statsBoxH * 0.78, { align: 'center' });
  });

  cursorY += statsBoxH + (isLandscape ? 9 : 14);

  // 6. Full Legend Box
  const legendBoxH = isLandscape ? 42 : 58;
  doc.setFillColor(palette.cardBloodBg);
  doc.setDrawColor(palette.cardBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(contentX, cursorY, contentWidth, legendBoxH, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(palette.textPrimary);
  doc.text('LEGENDA SIMBOL SILSILAH', centerX, cursorY + 7, { align: 'center' });

  doc.setDrawColor(palette.legendBorder);
  doc.setLineWidth(0.2);
  doc.line(contentX + 8, cursorY + 9.5, contentX + contentWidth - 8, cursorY + 9.5);

  const legendCols = isLandscape ? 3 : 2;
  const legendCellW = (contentWidth - 16) / legendCols;
  const legendStartY = cursorY + 16;
  const legendRowGap = isLandscape ? 11 : 13;

  const drawLegendItem = (
    idx: number,
    drawIcon: (ix: number, iy: number) => void,
    title: string,
    desc: string,
  ) => {
    const col = idx % legendCols;
    const row = Math.floor(idx / legendCols);
    const ix = contentX + 10 + col * legendCellW;
    const iy = legendStartY + row * legendRowGap;

    drawIcon(ix, iy);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(palette.textPrimary);
    doc.text(title, ix + 11, iy - 0.3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(palette.textMuted);
    doc.text(desc, ix + 11, iy + 3.4);
  };

  // Item 0: Garis Nasab
  drawLegendItem(
    0,
    (ix, iy) => {
      doc.setFillColor(palette.cardBloodBg);
      doc.setDrawColor(palette.cardBorder);
      doc.setLineWidth(0.4);
      doc.roundedRect(ix, iy - 2.6, 8, 5, 1, 1, 'FD');
      doc.setDrawColor(palette.edgeNasab);
      doc.setLineWidth(0.5);
      doc.line(ix + 4, iy + 2.4, ix + 4, iy + 4.4);
    },
    'Garis Nasab',
    'Keturunan langsung (garis solid)',
  );

  // Item 1: Menantu
  drawLegendItem(
    1,
    (ix, iy) => {
      doc.setFillColor(palette.cardSpouseBg);
      doc.setDrawColor(palette.cardSpouseBorder);
      doc.setLineWidth(0.4);
      doc.setLineDashPattern([1.2, 0.9], 0);
      doc.roundedRect(ix, iy - 2.6, 8, 5, 1, 1, 'FD');
      doc.setLineDashPattern([], 0);
    },
    'Menantu',
    'Pasangan dari luar trah (putus-putus)',
  );

  // Item 2: Ikatan Pernikahan
  drawLegendItem(
    2,
    (ix, iy) => {
      doc.setDrawColor(palette.edgeMarried);
      doc.setLineWidth(0.55);
      doc.line(ix, iy, ix + 8, iy);
      doc.setFillColor(palette.unionFill);
      doc.setDrawColor(palette.unionStroke);
      doc.setLineWidth(0.4);
      doc.circle(ix + 4, iy, 1.8, 'FD');
    },
    'Ikatan Pernikahan',
    'Garis sambung pernikahan aktif',
  );

  // Item 3: Cerai //
  drawLegendItem(
    3,
    (ix, iy) => {
      doc.setDrawColor(palette.edgeDivorced);
      doc.setLineWidth(0.55);
      doc.setLineDashPattern([1.5, 1], 0);
      doc.line(ix, iy + 1.2, ix + 8, iy + 1.2);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(palette.edgeDivorced);
      doc.text('//', ix + 4, iy - 0.6, { align: 'center' });
    },
    'Cerai (//)',
    'Pernikahan berpisah / bercerai',
  );

  // Item 4: Masih Hidup
  drawLegendItem(
    4,
    (ix, iy) => {
      doc.setFillColor(palette.aliveDotFill);
      doc.circle(ix + 4, iy, 1.8, 'F');
    },
    'Masih Hidup',
    'Titik status anggota masih hidup',
  );

  // Item 5: Wafat (Alm./Almh.)
  drawLegendItem(
    5,
    (ix, iy) => {
      doc.setFillColor(palette.deceasedDotFill);
      doc.setDrawColor(palette.deceasedDotStroke);
      doc.setLineWidth(0.45);
      doc.circle(ix + 4, iy, 1.8, 'FD');
    },
    'Wafat (Alm./Almh.)',
    'Ditandai teks Alm. / Almh.',
  );

  // 7. Print Date Footer inside frame
  const todayIso = new Date().toISOString().slice(0, 10);
  const printDateId = formatDateId(todayIso);
  const footerY = pageH - innerInset - 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(palette.textSecondary);
  doc.text(`Dicetak pada ${printDateId}`, centerX, footerY, { align: 'center' });
}
