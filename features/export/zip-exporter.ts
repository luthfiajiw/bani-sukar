import {
  DESKTOP_MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE_PX,
} from './constants';
import {
  computePosterPagination,
  getPosterPhysicalDimensions,
} from './paginator-poster';
import { renderSvgStringToCanvas } from './raster-exporter';
import {
  renderSceneToSvgString,
  renderTileCropToSvgString,
} from './svg-renderer';
import type {
  BookPaginationResult,
  ExportExecutionOptions,
  ExportScene,
  ExportSettings,
  PosterPaginationResult,
} from './types';

export interface GenerateTiledZipParams {
  scene: ExportScene;
  settings: ExportSettings;
  posterPagination?: PosterPaginationResult;
  bookPagination?: BookPaginationResult;
  format: 'png' | 'jpg';
  options?: ExportExecutionOptions;
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Proses pembuatan ZIP dibatalkan', 'AbortError');
  }
  const err = new Error('Proses pembuatan ZIP dibatalkan');
  err.name = 'AbortError';
  return err;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function clampCanvasDimensions(
  rawWidthPx: number,
  rawHeightPx: number,
  maxPixels = DESKTOP_MAX_CANVAS_PIXELS,
): { widthPx: number; heightPx: number } {
  let widthPx = Math.max(1, Math.round(rawWidthPx));
  let heightPx = Math.max(1, Math.round(rawHeightPx));

  const maxSideRatio = Math.max(
    widthPx / MAX_CANVAS_SIDE_PX,
    heightPx / MAX_CANVAS_SIDE_PX,
    1,
  );
  if (maxSideRatio > 1) {
    widthPx = Math.max(1, Math.floor(widthPx / maxSideRatio));
    heightPx = Math.max(1, Math.floor(heightPx / maxSideRatio));
  }

  const totalPixels = widthPx * heightPx;
  if (totalPixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / totalPixels);
    widthPx = Math.max(1, Math.floor(widthPx * scale));
    heightPx = Math.max(1, Math.floor(heightPx * scale));
  }

  return { widthPx, heightPx };
}

async function canvasToUint8Array(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg',
): Promise<Uint8Array<ArrayBuffer>> {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.92 : undefined;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error(`Gagal menyandikan kanvas ke ${format.toUpperCase()}.`));
        }
      },
      mimeType,
      quality,
    );
  });

  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

function buildPosterGuideText(
  scene: ExportScene,
  pagination: PosterPaginationResult,
  settings: ExportSettings,
  format: 'png' | 'jpg',
): string {
  const physical = getPosterPhysicalDimensions(
    scene.width,
    scene.height,
    pagination.effectiveScale,
  );

  const lines: string[] = [
    '============================================================',
    `PANDUAN SUSUNAN POSTER — ${settings.meta.title}`,
    `Subjudul      : ${settings.meta.subtitle || '-'}`,
    `Format Gambar : ${format.toUpperCase()} (${settings.pngDpi} DPI)`,
    `Ukuran Kertas : ${settings.paper.sizeId} (${pagination.paperWidthMm} x ${pagination.paperHeightMm} mm, ${settings.paper.orientation})`,
    `Grid Lembar   : ${pagination.cols} kolom x ${pagination.rows} baris (${pagination.totalTiles} file)`,
    `Ukuran Poster : ${physical.posterWidthCm.toFixed(1)} x ${physical.posterHeightCm.toFixed(1)} cm`,
    `Overlap Lem   : ${settings.paper.overlapMm} mm`,
    '============================================================',
    '',
    'PETA KOORDINAT LEMBAR:',
  ];

  for (let r = 0; r < pagination.rows; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c < pagination.cols; c++) {
      const tile = pagination.tiles.find((t) => t.row === r && t.col === c);
      rowCells.push(tile ? `[${tile.coordLabel}]` : '[  ]');
    }
    lines.push(`  ${rowCells.join('  ')}`);
  }

  lines.push('');
  lines.push('CARA MENYAMBUNG:');
  lines.push('1. Cetak seluruh berkas tile-*.png/jpg dengan skala 100% (Fit to Printable Area).');
  lines.push('2. Susun dari kiri ke kanan (A1 -> A2 -> ...) lalu baris berikutnya (B1 -> B2 -> ...).');
  lines.push(`3. Gunakan area overlap ${settings.paper.overlapMm} mm pada tepi sambungan untuk menempel lem.`);
  lines.push('');
  lines.push('DAFTAR BERKAS:');
  for (const tile of pagination.tiles) {
    lines.push(`- tile-${tile.coordLabel}.${format}`);
  }

  return lines.join('\n');
}

function buildBookGuideText(
  bookPagination: BookPaginationResult,
  settings: ExportSettings,
  format: 'png' | 'jpg',
): string {
  const lines: string[] = [
    '============================================================',
    `DAFTAR HALAMAN BUKU SILSILAH — ${settings.meta.title}`,
    `Subjudul      : ${settings.meta.subtitle || '-'}`,
    `Format Gambar : ${format.toUpperCase()} (${settings.pngDpi} DPI)`,
    `Total Halaman : ${bookPagination.totalPages}`,
    '============================================================',
    '',
    'DAFTAR ISI HALAMAN:',
  ];

  for (const page of bookPagination.pages) {
    const numStr = String(page.pageNumber).padStart(2, '0');
    const parentRef = page.parentPageNumber
      ? ` (Lanjutan dari hal. ${page.parentPageNumber})`
      : ' (Halaman Pembuka)';
    const breadcrumb =
      page.lineageBreadcrumb.length > 0
        ? ` | Jalur: ${page.lineageBreadcrumb.join(' > ')}`
        : '';
    lines.push(
      `- hal-${numStr}.${format} — ${page.rootPersonName}${parentRef}${breadcrumb}`,
    );
  }

  return lines.join('\n');
}

/**
 * Mengemas setiap potongan tile poster (`tile-A1.png`, ...) atau halaman buku
 * (`hal-01.png`, ...) menjadi satu arsip `.zip` tanpa melebihi batas memori
 * kanvas browser karena setiap halaman dirasterisasi satu per satu.
 */
export async function generateTiledZipBlob(
  params: GenerateTiledZipParams,
): Promise<Blob> {
  const { scene, settings, format, options } = params;
  checkAborted(options?.signal);

  const { zipSync, strToU8 } = await import('fflate');
  checkAborted(options?.signal);

  const files: Record<string, Uint8Array<ArrayBuffer>> = {};
  const dpi = settings.pngDpi || 150;
  const hasBrowserCanvas = typeof document !== 'undefined';

  if (settings.mode === 'book' && params.bookPagination) {
    const pages = params.bookPagination.pages;
    const totalSteps = Math.max(1, pages.length);

    files['00-panduan-susunan.txt'] = strToU8(
      buildBookGuideText(params.bookPagination, settings, format),
    );

    if (hasBrowserCanvas) {
      for (let idx = 0; idx < pages.length; idx++) {
        checkAborted(options?.signal);
        const page = pages[idx];
        const numStr = String(page.pageNumber).padStart(2, '0');
        const subtitle = page.parentPageNumber
          ? `Lanjutan dari hal. ${page.parentPageNumber} • ${page.lineageBreadcrumb.join(' › ')}`
          : settings.meta.subtitle;

        const svgString = renderSceneToSvgString(page.scene, {
          title: `${settings.meta.title} (Hal. ${page.pageNumber}/${pages.length})`,
          subtitle,
          includeHeader: true,
          includeLegend: settings.meta.includeLegend,
          theme: settings.theme,
        });

        const scaleFactor = dpi / 96;
        const { widthPx, heightPx } = clampCanvasDimensions(
          page.scene.width * scaleFactor,
          (page.scene.height + 100) * scaleFactor,
        );

        const canvas = await renderSvgStringToCanvas(svgString, widthPx, heightPx);
        checkAborted(options?.signal);

        files[`hal-${numStr}.${format}`] = await canvasToUint8Array(canvas, format);
        canvas.width = 0;
        canvas.height = 0;

        options?.onProgress?.({
          phase: 'rendering',
          current: idx + 1,
          total: totalSteps,
          message: `Merender hal-${numStr}.${format} (${idx + 1}/${totalSteps})...`,
        });
      }
    }
  } else {
    const pagination =
      params.posterPagination ??
      computePosterPagination(
        scene.width,
        scene.height,
        settings.paper,
        settings.scale,
      );

    const tiles = pagination.tiles;
    const totalSteps = Math.max(1, tiles.length + (hasBrowserCanvas ? 1 : 0));

    files['00-panduan-susunan.txt'] = strToU8(
      buildPosterGuideText(scene, pagination, settings, format),
    );

    if (hasBrowserCanvas) {
      const rawTileW = (pagination.printableWidthMm / 25.4) * dpi;
      const rawTileH = (pagination.printableHeightMm / 25.4) * dpi;
      const { widthPx: tileW, heightPx: tileH } = clampCanvasDimensions(
        rawTileW,
        rawTileH,
      );

      for (let idx = 0; idx < tiles.length; idx++) {
        checkAborted(options?.signal);
        const tile = tiles[idx];

        const tileSvg = renderTileCropToSvgString(scene, tile.sceneCropRect, {
          width: tileW,
          height: tileH,
          ariaLabel: `Tile ${tile.coordLabel}`,
        });

        const canvas = await renderSvgStringToCanvas(tileSvg, tileW, tileH);
        checkAborted(options?.signal);

        files[`tile-${tile.coordLabel}.${format}`] = await canvasToUint8Array(
          canvas,
          format,
        );
        canvas.width = 0;
        canvas.height = 0;

        options?.onProgress?.({
          phase: 'rendering',
          current: idx + 1,
          total: totalSteps,
          message: `Merender tile-${tile.coordLabel}.${format} (${idx + 1}/${tiles.length})...`,
        });
      }

      // Gambar ikhtisar susunan untuk memudahkan pencocokan urutan tile
      checkAborted(options?.signal);
      const overviewMaxW = 1600;
      const overviewScale = Math.min(1, overviewMaxW / Math.max(1, scene.width));
      const overviewW = Math.max(320, Math.round(scene.width * overviewScale));
      const overviewH = Math.max(
        240,
        Math.round((scene.height + 100) * overviewScale),
      );
      const overviewSvg = renderSceneToSvgString(scene, {
        title: settings.meta.title,
        subtitle: `${settings.meta.subtitle} • ${pagination.cols}×${pagination.rows} lembar`,
        includeHeader: true,
        includeLegend: settings.meta.includeLegend,
        theme: settings.theme,
        width: overviewW,
        height: overviewH,
      });

      const overviewCanvas = await renderSvgStringToCanvas(
        overviewSvg,
        overviewW,
        overviewH,
      );
      files[`00-peta-susunan.${format}`] = await canvasToUint8Array(
        overviewCanvas,
        format,
      );
      overviewCanvas.width = 0;
      overviewCanvas.height = 0;

      options?.onProgress?.({
        phase: 'packaging',
        current: totalSteps,
        total: totalSteps,
        message: 'Mengemas arsip ZIP...',
      });
    }
  }

  checkAborted(options?.signal);
  const zipped = zipSync(files, { level: 6 });

  options?.onProgress?.({
    phase: 'done',
    current: 1,
    total: 1,
    message: 'Arsip ZIP siap diunduh.',
  });

  return new Blob([zipped], { type: 'application/zip' });
}
