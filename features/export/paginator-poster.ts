import {
  MIN_NAME_FONT_SIZE_PX,
  MM_TO_PT,
  PAPER_SIZES,
  PT_TO_MM,
  PX_TO_MM,
} from './constants';
import type {
  PaperConfig,
  PosterPaginationResult,
  PosterTile,
  ScaleConfig,
} from './types';

export interface PosterPaginationOutput extends PosterPaginationResult {
  strideWidthMm: number;
  strideHeightMm: number;
  posterWidthMm: number;
  posterHeightMm: number;
  posterWidthCm: number;
  posterHeightCm: number;
}

const EPSILON = 1e-6;

/**
 * Mengonversi indeks baris 0-based menjadi label huruf (0 -> A, 25 -> Z, 26 -> AA).
 */
export function formatRowLabel(row: number): string {
  let n = Math.max(0, Math.floor(row));
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Membentuk label koordinat tile poster, mis. (0, 0) -> "A1", (1, 2) -> "B3".
 */
export function formatTileCoordLabel(row: number, col: number): string {
  return `${formatRowLabel(row)}${Math.max(0, Math.floor(col)) + 1}`;
}

/**
 * Menentukan dimensi fisik kertas (mm) setelah menerapkan ukuran dasar dan orientasi.
 */
export function resolvePaperDimensionsMm(paperConfig: PaperConfig): {
  paperWidthMm: number;
  paperHeightMm: number;
} {
  let baseWidthMm: number;
  let baseHeightMm: number;

  if (paperConfig.sizeId === 'CUSTOM') {
    const rawW = Number.isFinite(paperConfig.customWidthMm)
      ? paperConfig.customWidthMm
      : PAPER_SIZES.CUSTOM.widthMm;
    const rawH = Number.isFinite(paperConfig.customHeightMm)
      ? paperConfig.customHeightMm
      : PAPER_SIZES.CUSTOM.heightMm;
    baseWidthMm = Math.max(20, rawW);
    baseHeightMm = Math.max(20, rawH);
  } else {
    const def = PAPER_SIZES[paperConfig.sizeId] ?? PAPER_SIZES.A4;
    baseWidthMm = def.widthMm;
    baseHeightMm = def.heightMm;
  }

  const shortSide = Math.min(baseWidthMm, baseHeightMm);
  const longSide = Math.max(baseWidthMm, baseHeightMm);

  if (paperConfig.orientation === 'landscape') {
    return { paperWidthMm: longSide, paperHeightMm: shortSide };
  }
  return { paperWidthMm: shortSide, paperHeightMm: longSide };
}

function computeTileCount(
  totalPrintMm: number,
  printableMm: number,
  strideMm: number,
): number {
  if (totalPrintMm <= printableMm + EPSILON) {
    return 1;
  }
  return 1 + Math.ceil((totalPrintMm - printableMm - EPSILON) / strideMm);
}

/**
 * Menghitung dimensi fisik poster total (mm dan cm) dari ukuran scene dan skala efektif.
 */
export function getPosterPhysicalDimensions(
  sceneWidthPx: number,
  sceneHeightPx: number,
  effectiveScale: number,
): {
  posterWidthMm: number;
  posterHeightMm: number;
  posterWidthCm: number;
  posterHeightCm: number;
} {
  const safeW = Math.max(0, Number.isFinite(sceneWidthPx) ? sceneWidthPx : 0);
  const safeH = Math.max(0, Number.isFinite(sceneHeightPx) ? sceneHeightPx : 0);
  const posterWidthMm = safeW * effectiveScale;
  const posterHeightMm = safeH * effectiveScale;
  return {
    posterWidthMm,
    posterHeightMm,
    posterWidthCm: posterWidthMm / 10,
    posterHeightCm: posterHeightMm / 10,
  };
}

/**
 * Menghitung paginasi poster (tiling geometris dengan overlap lem, label koordinat A1..RnCn,
 * dan pointer tetangga) untuk ketiga mode skala: `percentage`, `fit-grid`, dan `min-font`.
 */
export function computePosterPagination(
  sceneWidthPx: number,
  sceneHeightPx: number,
  paperConfig: PaperConfig,
  scaleConfig: ScaleConfig,
  baseMinFontPx: number = MIN_NAME_FONT_SIZE_PX,
): PosterPaginationOutput {
  const { paperWidthMm, paperHeightMm } = resolvePaperDimensionsMm(paperConfig);

  const rawMargin = Number.isFinite(paperConfig.marginMm)
    ? Math.max(0, paperConfig.marginMm)
    : 8;
  // Pastikan area cetak selalu positif minimal 1 mm
  const maxAllowedMargin = Math.min(paperWidthMm, paperHeightMm) / 2 - 0.5;
  const marginMm = Math.min(rawMargin, Math.max(0, maxAllowedMargin));

  const printableWidthMm = Math.max(1, paperWidthMm - 2 * marginMm);
  const printableHeightMm = Math.max(1, paperHeightMm - 2 * marginMm);

  const rawOverlap = Number.isFinite(paperConfig.overlapMm)
    ? Math.max(0, paperConfig.overlapMm)
    : 10;
  const overlapXMm = Math.min(rawOverlap, Math.max(0, printableWidthMm - 1));
  const overlapYMm = Math.min(rawOverlap, Math.max(0, printableHeightMm - 1));

  const strideWidthMm = printableWidthMm - overlapXMm;
  const strideHeightMm = printableHeightMm - overlapYMm;

  const safeSceneW =
    Number.isFinite(sceneWidthPx) && sceneWidthPx > 0 ? sceneWidthPx : 1;
  const safeSceneH =
    Number.isFinite(sceneHeightPx) && sceneHeightPx > 0 ? sceneHeightPx : 1;
  const safeBaseFontPx =
    Number.isFinite(baseMinFontPx) && baseMinFontPx > 0
      ? baseMinFontPx
      : MIN_NAME_FONT_SIZE_PX;

  let effectiveScale: number;

  if (scaleConfig.mode === 'percentage') {
    const pct =
      Number.isFinite(scaleConfig.percentage) && scaleConfig.percentage > 0
        ? scaleConfig.percentage
        : 100;
    effectiveScale = (pct / 100) * PX_TO_MM;
  } else if (scaleConfig.mode === 'fit-grid') {
    const fitCols =
      Number.isFinite(scaleConfig.fitCols) && scaleConfig.fitCols >= 1
        ? Math.floor(scaleConfig.fitCols)
        : 1;
    const fitRows =
      Number.isFinite(scaleConfig.fitRows) && scaleConfig.fitRows >= 1
        ? Math.floor(scaleConfig.fitRows)
        : 1;
    const availableW = printableWidthMm + (fitCols - 1) * strideWidthMm;
    const availableH = printableHeightMm + (fitRows - 1) * strideHeightMm;
    effectiveScale = Math.min(availableW / safeSceneW, availableH / safeSceneH);
  } else {
    // 'min-font': skala sehingga teks terkecil berukuran tepat minFontPt (1 pt = 25.4 / 72 mm)
    const minFontPt =
      Number.isFinite(scaleConfig.minFontPt) && scaleConfig.minFontPt > 0
        ? scaleConfig.minFontPt
        : 8;
    effectiveScale = (minFontPt * PT_TO_MM) / safeBaseFontPx;
  }

  const effectiveMinFontPt = safeBaseFontPx * effectiveScale * MM_TO_PT;

  const totalPrintWidthMm =
    sceneWidthPx > 0 ? sceneWidthPx * effectiveScale : 0;
  const totalPrintHeightMm =
    sceneHeightPx > 0 ? sceneHeightPx * effectiveScale : 0;

  const cols = computeTileCount(
    totalPrintWidthMm,
    printableWidthMm,
    strideWidthMm,
  );
  const rows = computeTileCount(
    totalPrintHeightMm,
    printableHeightMm,
    strideHeightMm,
  );

  const printableWidthPx = printableWidthMm / effectiveScale;
  const printableHeightPx = printableHeightMm / effectiveScale;
  const strideWidthPx = strideWidthMm / effectiveScale;
  const strideHeightPx = strideHeightMm / effectiveScale;

  const tiles: PosterTile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const cropX = col * strideWidthPx;
      const cropY = row * strideHeightPx;
      const coreWidth = col < cols - 1 ? strideWidthPx : printableWidthPx;
      const coreHeight = row < rows - 1 ? strideHeightPx : printableHeightPx;

      tiles.push({
        index,
        row,
        col,
        coordLabel: formatTileCoordLabel(row, col),
        neighborLabels: {
          top: row > 0 ? formatTileCoordLabel(row - 1, col) : null,
          right: col < cols - 1 ? formatTileCoordLabel(row, col + 1) : null,
          bottom: row < rows - 1 ? formatTileCoordLabel(row + 1, col) : null,
          left: col > 0 ? formatTileCoordLabel(row, col - 1) : null,
        },
        sceneCropRect: {
          x: cropX,
          y: cropY,
          width: printableWidthPx,
          height: printableHeightPx,
        },
        coreSceneRect: {
          x: cropX,
          y: cropY,
          width: coreWidth,
          height: coreHeight,
        },
      });
    }
  }

  const physical = getPosterPhysicalDimensions(
    sceneWidthPx,
    sceneHeightPx,
    effectiveScale,
  );

  return {
    paperWidthMm,
    paperHeightMm,
    printableWidthMm,
    printableHeightMm,
    effectiveScale,
    effectiveMinFontPt,
    cols,
    rows,
    totalTiles: tiles.length,
    tiles,
    strideWidthMm,
    strideHeightMm,
    ...physical,
  };
}
