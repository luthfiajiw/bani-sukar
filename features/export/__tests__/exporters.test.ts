import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGraph } from '@/features/family/graph';
import { computeLayout } from '@/features/family/layout';
import type { Person, Union } from '@/features/family/types';
import {
  DEFAULT_EXPORT_SETTINGS,
  DESKTOP_MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE_PX,
  MOBILE_MAX_CANVAS_PIXELS,
} from '../constants';
import { computePosterPagination } from '../paginator-poster';
import { generatePosterPdfBlob } from '../pdf-poster';
import { preloadPhotosAsDataUrls } from '../photo-loader';
import {
  checkSinglePngCanvasSafety,
  generateSinglePngBlob,
  generateSvgBlob,
} from '../raster-exporter';
import { buildExportScene } from '../scene';
import { canUseWebShareForFiles, shareOrDownloadBlob } from '../share-helper';
import { computeFittedMetricsForGraph } from '../text-fit';
import type { ExportScene, ExportSettings, PrintThemeId } from '../types';
import { generateTiledZipBlob } from '../zip-exporter';

function makePerson(
  overrides: Partial<Person> & { id: string; fullName: string },
): Person {
  return {
    nickname: null,
    gender: 'L',
    birthPlace: null,
    birthDate: null,
    isDeceased: false,
    deathDate: null,
    isBloodLine: true,
    parentUnionId: null,
    birthOrder: null,
    photoPath: null,
    photoUrl: null,
    ...overrides,
  };
}

function makeSampleSettings(
  overrides?: Partial<ExportSettings>,
): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    ...overrides,
    cardToggles: {
      ...DEFAULT_EXPORT_SETTINGS.cardToggles,
      ...overrides?.cardToggles,
    },
    scope: {
      ...DEFAULT_EXPORT_SETTINGS.scope,
      ...overrides?.scope,
    },
    paper: {
      ...DEFAULT_EXPORT_SETTINGS.paper,
      ...overrides?.paper,
    },
    scale: {
      ...DEFAULT_EXPORT_SETTINGS.scale,
      ...overrides?.scale,
    },
    meta: {
      ...DEFAULT_EXPORT_SETTINGS.meta,
      ...overrides?.meta,
    },
  };
}

function makeSampleScene(settings: ExportSettings) {
  const persons: Person[] = [
    makePerson({
      id: 'p-sukar',
      fullName: 'Sukar Hadiwijaya',
      nickname: 'Mbah Sukar',
      gender: 'L',
      birthPlace: 'Klaten',
      birthDate: '1930-01-01',
      deathDate: '1998-05-12',
      isDeceased: true,
      isBloodLine: true,
    }),
    makePerson({
      id: 'p-sadirah',
      fullName: 'Sadirah',
      nickname: 'Mbah Dirah',
      gender: 'P',
      birthPlace: 'Solo',
      birthDate: '1935-04-02',
      deathDate: '2010-08-20',
      isDeceased: true,
      isBloodLine: false,
    }),
    makePerson({
      id: 'p-anak1',
      fullName: 'Sukijah Rahmawati',
      gender: 'P',
      birthDate: '1958-02-14',
      isDeceased: false,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 1,
    }),
    makePerson({
      id: 'p-menantu1',
      fullName: 'Ahmad Fauzi',
      gender: 'L',
      birthDate: '1955-06-10',
      isDeceased: false,
      isBloodLine: false,
    }),
    makePerson({
      id: 'p-anak2',
      fullName: 'Bambang Sutrisno',
      gender: 'L',
      birthDate: '1962-11-20',
      isDeceased: false,
      isBloodLine: true,
      parentUnionId: 'u-root',
      birthOrder: 2,
    }),
    makePerson({
      id: 'p-cucu1',
      fullName: 'Ali Mahmudi Kusuma',
      gender: 'L',
      birthDate: '1984-09-01',
      isDeceased: false,
      isBloodLine: true,
      parentUnionId: 'u-anak1',
      birthOrder: 1,
    }),
  ];

  const unions: Union[] = [
    {
      id: 'u-root',
      husbandId: 'p-sukar',
      wifeId: 'p-sadirah',
      status: 'married',
      unionOrder: 1,
    },
    {
      id: 'u-anak1',
      husbandId: 'p-menantu1',
      wifeId: 'p-anak1',
      status: 'divorced',
      unionOrder: 1,
    },
  ];

  const graph = buildGraph(persons, unions);
  const fitted = computeFittedMetricsForGraph(graph, settings);
  const layout = computeLayout(graph, {
    orientation: settings.treeOrientation,
    cardSizeByPersonId: fitted.cardSizeByPersonId,
    rowHeightByGeneration: fitted.rowHeightByGeneration,
  });
  const scene = buildExportScene(layout, settings, {
    fittedMetrics: fitted.metricsByPersonId,
  });

  return { persons, unions, graph, scene };
}

function makeDummyScene(width: number, height: number): ExportScene {
  return {
    width,
    height,
    backgroundColor: '#ffffff',
    primitives: [],
    nodeBounds: new Map(),
  };
}

describe('export engines', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('pdf-poster', () => {
    it('generates a valid multi-page PDF Blob with cover page, assembly map, and tile pages', async () => {
      const settings = makeSampleSettings({
        paper: {
          ...DEFAULT_EXPORT_SETTINGS.paper,
          sizeId: 'A4',
          orientation: 'landscape',
          marginMm: 8,
          overlapMm: 10,
          showCutMarks: true,
          showTileLabels: true,
          includeAssemblyMap: true,
        },
        scale: {
          ...DEFAULT_EXPORT_SETTINGS.scale,
          mode: 'fit-grid',
          fitCols: 2,
          fitRows: 2,
        },
        meta: {
          ...DEFAULT_EXPORT_SETTINGS.meta,
          title: 'Silsilah Bani Sukar',
          subtitle: 'Uji Coba Poster',
          includeCoverPage: true,
          includeLegend: true,
          includeFooter: true,
        },
      });

      const { persons, unions, scene } = makeSampleScene(settings);
      const pagination = computePosterPagination(
        scene.width,
        scene.height,
        settings.paper,
        settings.scale,
      );

      expect(pagination.totalTiles).toBeGreaterThanOrEqual(2);

      const progressEvents: number[] = [];
      const blob = await generatePosterPdfBlob(scene, pagination, settings, {
        stats: {
          personCount: persons.length,
          unionCount: unions.length,
          minGeneration: 1,
          maxGeneration: 3,
        },
        onProgress: (p) => progressEvents.push(p.current),
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(2000);
      expect(progressEvents.length).toBeGreaterThan(0);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const header = new TextDecoder('latin1').decode(bytes.slice(0, 8));
      expect(header.startsWith('%PDF-')).toBe(true);

      const pdfText = new TextDecoder('latin1').decode(bytes);
      const expectedPages = 1 + 1 + pagination.totalTiles;
      expect(pdfText).toContain(`/Count ${expectedPages}`);
    });

    it('supports monochrome and ink-saver themes without cover or assembly map', async () => {
      const themes: PrintThemeId[] = ['ink-saver', 'monochrome'];
      for (const theme of themes) {
        const settings = makeSampleSettings({
          theme,
          paper: {
            ...DEFAULT_EXPORT_SETTINGS.paper,
            includeAssemblyMap: false,
          },
          meta: {
            ...DEFAULT_EXPORT_SETTINGS.meta,
            includeCoverPage: false,
            includeFooter: false,
          },
        });

        const { scene } = makeSampleScene(settings);
        const pagination = computePosterPagination(
          scene.width,
          scene.height,
          settings.paper,
          settings.scale,
        );

        const blob = await generatePosterPdfBlob(scene, pagination, settings);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pdfText = new TextDecoder('latin1').decode(bytes);
        expect(pdfText.startsWith('%PDF-')).toBe(true);
        expect(pdfText).toContain(`/Count ${pagination.totalTiles}`);
      }
    });

    it('throws AbortError when cancelled via AbortSignal', async () => {
      const settings = makeSampleSettings();
      const { scene } = makeSampleScene(settings);
      const pagination = computePosterPagination(
        scene.width,
        scene.height,
        settings.paper,
        settings.scale,
      );

      const controller = new AbortController();
      controller.abort();

      await expect(
        generatePosterPdfBlob(scene, pagination, settings, {
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  describe('raster-exporter', () => {
    it('generates a standalone SVG Blob containing scene names and legend', async () => {
      const settings = makeSampleSettings({
        meta: {
          ...DEFAULT_EXPORT_SETTINGS.meta,
          title: 'Silsilah Keluarga',
          subtitle: 'Semua Cabang',
          includeLegend: true,
        },
      });
      const { scene } = makeSampleScene(settings);
      const blob = generateSvgBlob(scene, settings);

      expect(blob.type).toContain('image/svg+xml');
      const svgText = await blob.text();
      expect(svgText.startsWith('<svg ')).toBe(true);
      expect(svgText).toContain('Alm. Sukar');
      expect(svgText).toContain('Hadiwijaya');
      expect(svgText).toContain('Ali Mahmudi Kusuma');
      expect(svgText).toContain('Silsilah Keluarga');
      expect(svgText).toContain('Keturunan (Nasab)');
    });

    it('checks desktop vs mobile canvas limits and recommends zip-tiles or lower-dpi appropriately', () => {
      const smallScene = makeDummyScene(1200, 800);
      const smallDesktop = checkSinglePngCanvasSafety(smallScene, 150, false);
      expect(smallDesktop.safe).toBe(true);
      expect(smallDesktop.maxPixels).toBe(DESKTOP_MAX_CANVAS_PIXELS);
      expect(smallDesktop.recommendedAction).toBeUndefined();

      // 3800 x 1800 @150 DPI -> 5938 x 2813 = ~16.7M px (aman di desktop 25M, tidak aman di mobile 12M)
      const mediumScene = makeDummyScene(3800, 1800);
      const desktopRes = checkSinglePngCanvasSafety(mediumScene, 150, false);
      const mobileRes = checkSinglePngCanvasSafety(mediumScene, 150, true);
      expect(desktopRes.safe).toBe(true);
      expect(mobileRes.safe).toBe(false);
      expect(mobileRes.maxPixels).toBe(MOBILE_MAX_CANVAS_PIXELS);
      expect(mobileRes.recommendedAction).toBe('zip-tiles');

      // Scene aman pada 150 DPI tapi melebihi batas pada 300 DPI -> rekomendasikan lower-dpi
      // 2400 x 1600 @150 DPI = 3750 x 2500 = 9.375M px (aman)
      // 2400 x 1600 @300 DPI = 7500 x 5000 = 37.5M px (melebihi desktop 25M)
      const dpiSensitiveScene = makeDummyScene(2400, 1600);
      const at300 = checkSinglePngCanvasSafety(dpiSensitiveScene, 300, false);
      expect(at300.safe).toBe(false);
      expect(at300.recommendedAction).toBe('lower-dpi');

      // Sisi melebihi MAX_CANVAS_SIDE_PX (16,384 px)
      const ultraWideScene = makeDummyScene(12000, 400);
      const wideCheck = checkSinglePngCanvasSafety(ultraWideScene, 150, false);
      expect(wideCheck.widthPx).toBeGreaterThan(MAX_CANVAS_SIDE_PX);
      expect(wideCheck.safe).toBe(false);
      expect(wideCheck.recommendedAction).toBe('zip-tiles');
    });

    it('returns exceedsCanvasLimit result from generateSinglePngBlob without touching DOM when unsafe', async () => {
      const settings = makeSampleSettings({ pngDpi: 300 });
      const hugeScene = makeDummyScene(8000, 5000);

      const res = await generateSinglePngBlob(hugeScene, settings, {
        isMobile: false,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.exceedsCanvasLimit).toBe(true);
        expect(res.recommendedAction).toBe('zip-tiles');
        expect(res.totalPixels).toBeGreaterThan(DESKTOP_MAX_CANVAS_PIXELS);
      }
    });
  });

  describe('zip-exporter & photo-loader', () => {
    it('packages 00-panduan-susunan.txt into a valid application/zip Blob in Node environment', async () => {
      const settings = makeSampleSettings({
        format: 'zip-png',
        scale: {
          ...DEFAULT_EXPORT_SETTINGS.scale,
          mode: 'fit-grid',
          fitCols: 2,
          fitRows: 1,
        },
      });
      const { scene } = makeSampleScene(settings);
      const pagination = computePosterPagination(
        scene.width,
        scene.height,
        settings.paper,
        settings.scale,
      );

      const zipBlob = await generateTiledZipBlob({
        scene,
        settings,
        posterPagination: pagination,
        format: 'png',
      });

      expect(zipBlob.type).toBe('application/zip');
      const bytes = new Uint8Array(await zipBlob.arrayBuffer());
      // Tanda tangan header ZIP: PK\x03\x04
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
      const text = new TextDecoder('latin1').decode(bytes);
      expect(text).toContain('00-panduan-susunan.txt');
    });

    it('returns empty Map gracefully from preloadPhotosAsDataUrls when running without DOM', async () => {
      const persons = [
        makePerson({
          id: 'p1',
          fullName: 'Sukar',
          photoUrl: 'https://example.com/photo.jpg',
        }),
      ];
      const photos = await preloadPhotosAsDataUrls(persons);
      expect(photos.size).toBe(0);
    });
  });

  describe('share-helper', () => {
    it('falls back gracefully to downloaded in Node environment', async () => {
      expect(canUseWebShareForFiles()).toBe(false);

      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const outcome = await shareOrDownloadBlob(blob, 'silsilah.pdf', {
        title: 'Silsilah Bani Sukar',
        preferShare: true,
      });

      expect(outcome).toBe('downloaded');
    });

    it('uses navigator.share when File sharing is supported and preferShare is true', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const canShareMock = vi.fn().mockReturnValue(true);

      vi.stubGlobal('navigator', {
        share: shareMock,
        canShare: canShareMock,
      });

      expect(canUseWebShareForFiles()).toBe(true);

      const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      const outcome = await shareOrDownloadBlob(blob, 'silsilah.pdf', {
        title: 'Silsilah Bani Sukar',
        text: 'Bagikan bagan',
        preferShare: true,
      });

      expect(outcome).toBe('shared');
      expect(shareMock).toHaveBeenCalledTimes(1);

      const downloadOutcome = await shareOrDownloadBlob(blob, 'silsilah.pdf', {
        preferShare: false,
      });
      expect(downloadOutcome).toBe('downloaded');
    });
  });
});
