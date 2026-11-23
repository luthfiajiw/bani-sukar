import {
  DESKTOP_MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE_PX,
  MOBILE_MAX_CANVAS_PIXELS,
} from './constants';
import { renderSceneToSvgString } from './svg-renderer';
import type {
  ExportExecutionOptions,
  ExportScene,
  ExportSettings,
  RasterExportResult,
} from './types';

export interface CanvasSafetyCheckResult {
  safe: boolean;
  widthPx: number;
  heightPx: number;
  totalPixels: number;
  maxPixels: number;
  recommendedAction?: 'zip-tiles' | 'lower-dpi';
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Proses rasterisasi dibatalkan', 'AbortError');
  }
  const err = new Error('Proses rasterisasi dibatalkan');
  err.name = 'AbortError';
  return err;
}

function computePixelDimensions(
  widthScenePx: number,
  heightScenePx: number,
  dpi: number,
): { widthPx: number; heightPx: number; totalPixels: number } {
  const safeDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : 150;
  const scale = safeDpi / 96;
  const widthPx = Math.max(1, Math.ceil(Math.max(1, widthScenePx) * scale));
  const heightPx = Math.max(1, Math.ceil(Math.max(1, heightScenePx) * scale));
  return {
    widthPx,
    heightPx,
    totalPixels: widthPx * heightPx,
  };
}

function computeSvgEnvelopeDimensions(
  scene: ExportScene,
  settings: ExportSettings,
): { width: number; height: number } {
  const hasTitle = Boolean(settings.meta.title?.trim());
  const hasSubtitle = Boolean(settings.meta.subtitle?.trim());
  const showHeader = hasTitle || hasSubtitle;
  const headerHeight = showHeader ? (hasTitle && hasSubtitle ? 60 : 42) : 0;
  const legendHeight = settings.meta.includeLegend ? 40 : 0;
  const totalWidth = settings.meta.includeLegend
    ? Math.max(scene.width, 660)
    : scene.width;
  const totalHeight = scene.height + headerHeight + legendHeight;
  return { width: totalWidth, height: totalHeight };
}

/**
 * Memeriksa apakah merasterisasi seluruh scene menjadi 1 kanvas PNG tunggal
 * pada DPI tertentu aman terhadap batas piksel dan sisi maksimum browser.
 */
export function checkSinglePngCanvasSafety(
  scene: ExportScene,
  dpi: number,
  isMobile = false,
): CanvasSafetyCheckResult {
  const maxPixels = isMobile
    ? MOBILE_MAX_CANVAS_PIXELS
    : DESKTOP_MAX_CANVAS_PIXELS;
  const { widthPx, heightPx, totalPixels } = computePixelDimensions(
    scene.width,
    scene.height,
    dpi,
  );

  const exceedsSide =
    widthPx > MAX_CANVAS_SIDE_PX || heightPx > MAX_CANVAS_SIDE_PX;
  const exceedsPixels = totalPixels > maxPixels;
  const safe = !exceedsSide && !exceedsPixels;

  if (safe) {
    return {
      safe: true,
      widthPx,
      heightPx,
      totalPixels,
      maxPixels,
    };
  }

  let recommendedAction: 'zip-tiles' | 'lower-dpi' = 'zip-tiles';
  if (dpi > 150) {
    const lower = computePixelDimensions(scene.width, scene.height, 150);
    if (
      lower.totalPixels <= maxPixels &&
      lower.widthPx <= MAX_CANVAS_SIDE_PX &&
      lower.heightPx <= MAX_CANVAS_SIDE_PX
    ) {
      recommendedAction = 'lower-dpi';
    }
  }

  return {
    safe: false,
    widthPx,
    heightPx,
    totalPixels,
    maxPixels,
    recommendedAction,
  };
}

/**
 * Menghasilkan berkas SVG vektor mandiri (`image/svg+xml`).
 */
export function generateSvgBlob(
  scene: ExportScene,
  settings: ExportSettings,
): Blob {
  const hasTitle = Boolean(settings.meta.title?.trim());
  const hasSubtitle = Boolean(settings.meta.subtitle?.trim());

  const svgString = renderSceneToSvgString(scene, {
    title: settings.meta.title,
    subtitle: settings.meta.subtitle,
    includeHeader: hasTitle || hasSubtitle,
    includeLegend: settings.meta.includeLegend,
    theme: settings.theme,
    ariaLabel: settings.meta.title || 'Bagan Silsilah Bani Sukar',
  });

  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Merender string SVG menjadi elemen `<canvas>` pada resolusi target.
 */
export async function renderSvgStringToCanvas(
  svgString: string,
  widthPx: number,
  heightPx: number,
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') {
    throw new Error(
      'Rasterisasi SVG ke canvas memerlukan lingkungan browser (DOM).',
    );
  }

  const targetW = Math.max(1, Math.round(widthPx));
  const targetH = Math.max(1, Math.round(heightPx));

  const svgBlob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageEl = new Image();
      imageEl.onload = () => resolve(imageEl);
      imageEl.onerror = () =>
        reject(new Error('Gagal memuat SVG ke elemen gambar untuk rasterisasi.'));
      imageEl.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Gagal mendapatkan konteks 2D pada elemen kanvas.');
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Gagal mengonversi kanvas menjadi berkas PNG.'));
        }
      },
      'image/png',
    );
  });
}

/**
 * Mengekspor seluruh bagan menjadi 1 berkas PNG utuh setelah memvalidasi
 * batas aman piksel kanvas browser. Bila melebihi batas, mengembalikan
 * sinyal `exceedsCanvasLimit: true` tanpa mengalokasikan `<canvas>`.
 */
export async function generateSinglePngBlob(
  scene: ExportScene,
  settings: ExportSettings,
  options?: ExportExecutionOptions & { isMobile?: boolean },
): Promise<RasterExportResult> {
  if (options?.signal?.aborted) {
    throw createAbortError();
  }

  const envelope = computeSvgEnvelopeDimensions(scene, settings);
  const envelopeScene: ExportScene = {
    ...scene,
    width: envelope.width,
    height: envelope.height,
  };

  const safety = checkSinglePngCanvasSafety(
    envelopeScene,
    settings.pngDpi,
    options?.isMobile,
  );

  if (!safety.safe) {
    return {
      ok: false,
      exceedsCanvasLimit: true,
      widthPx: safety.widthPx,
      heightPx: safety.heightPx,
      totalPixels: safety.totalPixels,
      recommendedAction: safety.recommendedAction ?? 'zip-tiles',
    };
  }

  options?.onProgress?.({
    phase: 'rendering',
    current: 0,
    total: 1,
    message: `Merasterisasi PNG utuh (${safety.widthPx} × ${safety.heightPx} px)...`,
  });

  const hasTitle = Boolean(settings.meta.title?.trim());
  const hasSubtitle = Boolean(settings.meta.subtitle?.trim());
  const svgString = renderSceneToSvgString(scene, {
    title: settings.meta.title,
    subtitle: settings.meta.subtitle,
    includeHeader: hasTitle || hasSubtitle,
    includeLegend: settings.meta.includeLegend,
    theme: settings.theme,
    width: safety.widthPx,
    height: safety.heightPx,
  });

  if (options?.signal?.aborted) {
    throw createAbortError();
  }

  const canvas = await renderSvgStringToCanvas(
    svgString,
    safety.widthPx,
    safety.heightPx,
  );

  if (options?.signal?.aborted) {
    throw createAbortError();
  }

  const blob = await canvasToPngBlob(canvas);
  // Bebaskan memori kanvas segera
  canvas.width = 0;
  canvas.height = 0;

  options?.onProgress?.({
    phase: 'done',
    current: 1,
    total: 1,
    message: 'Gambar PNG utuh siap diunduh.',
  });

  return {
    ok: true,
    blob,
    widthPx: safety.widthPx,
    heightPx: safety.heightPx,
  };
}
