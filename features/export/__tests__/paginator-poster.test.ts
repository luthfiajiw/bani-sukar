import { describe, expect, it } from 'vitest';
import {
  CARD_PRESETS,
  DEFAULT_EXPORT_SETTINGS,
  MM_TO_PT,
  PAPER_SIZES,
  PT_TO_MM,
  PX_TO_MM,
} from '../constants';
import {
  computePosterPagination,
  formatRowLabel,
  formatTileCoordLabel,
  resolvePaperDimensionsMm,
} from '../paginator-poster';
import type { ExportSettings, PaperConfig, ScaleConfig } from '../types';
import {
  buildExportFilename,
  parseExportSettingsFromSearchParams,
  serializeExportSettingsToSearchParams,
} from '../url-state';

function makePaper(overrides: Partial<PaperConfig> = {}): PaperConfig {
  return {
    ...DEFAULT_EXPORT_SETTINGS.paper,
    ...overrides,
  };
}

function makeScale(overrides: Partial<ScaleConfig> = {}): ScaleConfig {
  return {
    ...DEFAULT_EXPORT_SETTINGS.scale,
    ...overrides,
  };
}

describe('paginator-poster', () => {
  describe('paper sizes & orientation', () => {
    it('resolves A4, A3, F4/Folio (215x330), Letter, and Custom in portrait & landscape', () => {
      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'A4', orientation: 'portrait' })),
      ).toEqual({ paperWidthMm: 210, paperHeightMm: 297 });

      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'A4', orientation: 'landscape' })),
      ).toEqual({ paperWidthMm: 297, paperHeightMm: 210 });

      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'A3', orientation: 'portrait' })),
      ).toEqual({ paperWidthMm: 297, paperHeightMm: 420 });

      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'F4', orientation: 'portrait' })),
      ).toEqual({ paperWidthMm: 215, paperHeightMm: 330 });

      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'F4', orientation: 'landscape' })),
      ).toEqual({ paperWidthMm: 330, paperHeightMm: 215 });

      expect(
        resolvePaperDimensionsMm(makePaper({ sizeId: 'LETTER', orientation: 'portrait' })),
      ).toEqual({
        paperWidthMm: PAPER_SIZES.LETTER.widthMm,
        paperHeightMm: PAPER_SIZES.LETTER.heightMm,
      });

      expect(
        resolvePaperDimensionsMm(
          makePaper({
            sizeId: 'CUSTOM',
            customWidthMm: 250,
            customHeightMm: 400,
            orientation: 'portrait',
          }),
        ),
      ).toEqual({ paperWidthMm: 250, paperHeightMm: 400 });

      expect(
        resolvePaperDimensionsMm(
          makePaper({
            sizeId: 'CUSTOM',
            customWidthMm: 250,
            customHeightMm: 400,
            orientation: 'landscape',
          }),
        ),
      ).toEqual({ paperWidthMm: 400, paperHeightMm: 250 });
    });
  });

  describe('overlap stride math, coordinate labels, and neighbor pointers', () => {
    it('computes printable area, stride with 10mm glue overlap, and exact tile counts', () => {
      // A4 landscape: 297 x 210 mm, margin 8 mm => printable 281 x 194 mm
      // overlap 10 mm => stride 271 x 184 mm
      // At 100% scale: 1 px = PX_TO_MM mm
      // 2 tiles wide cover up to 281 + 271 = 552 mm
      const widthForTwoColsMm = 552;
      const sceneWidthPx = widthForTwoColsMm / PX_TO_MM;
      const heightForOneRowMm = 194;
      const sceneHeightPx = heightForOneRowMm / PX_TO_MM;

      const res = computePosterPagination(
        sceneWidthPx,
        sceneHeightPx,
        makePaper({ sizeId: 'A4', orientation: 'landscape', marginMm: 8, overlapMm: 10 }),
        makeScale({ mode: 'percentage', percentage: 100 }),
      );

      expect(res.printableWidthMm).toBeCloseTo(281, 5);
      expect(res.printableHeightMm).toBeCloseTo(194, 5);
      expect(res.strideWidthMm).toBeCloseTo(271, 5);
      expect(res.strideHeightMm).toBeCloseTo(184, 5);
      expect(res.cols).toBe(2);
      expect(res.rows).toBe(1);
      expect(res.totalTiles).toBe(2);

      // Adding 2 mm pushes into a 3rd column
      const res3 = computePosterPagination(
        (widthForTwoColsMm + 2) / PX_TO_MM,
        sceneHeightPx,
        makePaper({ sizeId: 'A4', orientation: 'landscape', marginMm: 8, overlapMm: 10 }),
        makeScale({ mode: 'percentage', percentage: 100 }),
      );
      expect(res3.cols).toBe(3);
      expect(res3.rows).toBe(1);
      expect(res3.totalTiles).toBe(3);
    });

    it('generates all A1..RnCn tiles (including empty corner tiles) with accurate neighbors and crop/core rects', () => {
      // Create a 3 cols x 2 rows grid
      // A4 portrait: 210x297, margin 10 => printable 190x277, overlap 10 => stride 180x267
      // Width = 400 mm (190 + 180 = 370 < 400 <= 550 => 3 cols)
      // Height = 300 mm (277 < 300 <= 544 => 2 rows)
      const sceneW = 400 / PX_TO_MM;
      const sceneH = 300 / PX_TO_MM;
      const res = computePosterPagination(
        sceneW,
        sceneH,
        makePaper({ sizeId: 'A4', orientation: 'portrait', marginMm: 10, overlapMm: 10 }),
        makeScale({ mode: 'percentage', percentage: 100 }),
      );

      expect(res.cols).toBe(3);
      expect(res.rows).toBe(2);
      expect(res.totalTiles).toBe(6);
      expect(res.tiles.map((t) => t.coordLabel)).toEqual([
        'A1',
        'A2',
        'A3',
        'B1',
        'B2',
        'B3',
      ]);

      // Verify neighbor pointers
      const byLabel = new Map(res.tiles.map((t) => [t.coordLabel, t]));
      expect(byLabel.get('A1')?.neighborLabels).toEqual({
        top: null,
        right: 'A2',
        bottom: 'B1',
        left: null,
      });
      expect(byLabel.get('A2')?.neighborLabels).toEqual({
        top: null,
        right: 'A3',
        bottom: 'B2',
        left: 'A1',
      });
      expect(byLabel.get('B3')?.neighborLabels).toEqual({
        top: 'A3',
        right: null,
        bottom: null,
        left: 'B2',
      });

      // Verify overlap between A1 and A2 equals 10 mm in scene px
      const a1 = byLabel.get('A1')!;
      const a2 = byLabel.get('A2')!;
      const b1 = byLabel.get('B1')!;

      const overlapPxX =
        a1.sceneCropRect.x + a1.sceneCropRect.width - a2.sceneCropRect.x;
      expect(overlapPxX * res.effectiveScale).toBeCloseTo(10, 5);

      const overlapPxY =
        a1.sceneCropRect.y + a1.sceneCropRect.height - b1.sceneCropRect.y;
      expect(overlapPxY * res.effectiveScale).toBeCloseTo(10, 5);

      // Verify coreSceneRect partitions seamlessly without overlap or gap
      expect(a1.coreSceneRect.x + a1.coreSceneRect.width).toBeCloseTo(
        a2.coreSceneRect.x,
        5,
      );
      expect(a1.coreSceneRect.y + a1.coreSceneRect.height).toBeCloseTo(
        b1.coreSceneRect.y,
        5,
      );
    });

    it('formats row labels beyond Z cleanly (A..Z, AA..)', () => {
      expect(formatRowLabel(0)).toBe('A');
      expect(formatRowLabel(25)).toBe('Z');
      expect(formatRowLabel(26)).toBe('AA');
      expect(formatTileCoordLabel(1, 3)).toBe('B4');
    });
  });

  describe('scale modes', () => {
    it('supports percentage mode (100% maps 1 scene px to 25.4/96 mm) and reports physical poster dimensions', () => {
      const res = computePosterPagination(
        2000,
        1000,
        makePaper({ sizeId: 'A4', orientation: 'landscape' }),
        makeScale({ mode: 'percentage', percentage: 100 }),
        12,
      );

      expect(res.effectiveScale).toBeCloseTo(PX_TO_MM, 8);
      expect(res.posterWidthMm).toBeCloseTo(2000 * PX_TO_MM, 5);
      expect(res.posterHeightMm).toBeCloseTo(1000 * PX_TO_MM, 5);
      expect(res.posterWidthCm).toBeCloseTo((2000 * PX_TO_MM) / 10, 5);
      expect(res.posterHeightCm).toBeCloseTo((1000 * PX_TO_MM) / 10, 5);
      // 12px at 100% CSS (96dpi) = 9pt (72pt/in)
      expect(res.effectiveMinFontPt).toBeCloseTo(9, 5);
    });

    it('supports fit-grid mode accounting for glue overlap so scene fits within fitCols x fitRows', () => {
      const paper = makePaper({
        sizeId: 'A4',
        orientation: 'landscape',
        marginMm: 8,
        overlapMm: 10,
      });
      // Available for 3x2:
      // W = 281 + 2 * 271 = 823 mm
      // H = 194 + 1 * 184 = 378 mm
      // Pick scene aspect ratio matching 823 : 378 (e.g. 4115 x 1890)
      const res = computePosterPagination(
        4115,
        1890,
        paper,
        makeScale({ mode: 'fit-grid', fitCols: 3, fitRows: 2 }),
      );

      expect(res.cols).toBe(3);
      expect(res.rows).toBe(2);
      expect(res.totalTiles).toBe(6);
      expect(res.posterWidthMm).toBeCloseTo(823, 3);
      expect(res.posterHeightMm).toBeCloseTo(378, 3);

      // Even with a non-matching aspect ratio, it never exceeds fitCols x fitRows
      const tallRes = computePosterPagination(
        1000,
        3000,
        paper,
        makeScale({ mode: 'fit-grid', fitCols: 3, fitRows: 2 }),
      );
      expect(tallRes.cols).toBeLessThanOrEqual(3);
      expect(tallRes.rows).toBeLessThanOrEqual(2);
      expect(tallRes.posterWidthMm).toBeLessThanOrEqual(823 + 1e-4);
      expect(tallRes.posterHeightMm).toBeLessThanOrEqual(378 + 1e-4);
    });

    it('supports min-font mode (1 pt = 25.4 / 72 mm) and auto-computes required cols x rows', () => {
      const baseMinFontPx = 9.5;
      const targetMinFontPt = 10;
      const res = computePosterPagination(
        3000,
        1200,
        makePaper({ sizeId: 'A4', orientation: 'landscape', marginMm: 8, overlapMm: 10 }),
        makeScale({ mode: 'min-font', minFontPt: targetMinFontPt }),
        baseMinFontPx,
      );

      const expectedScale = (targetMinFontPt * PT_TO_MM) / baseMinFontPx;
      expect(res.effectiveScale).toBeCloseTo(expectedScale, 8);
      expect(res.effectiveMinFontPt).toBeCloseTo(targetMinFontPt, 6);
      expect(res.effectiveMinFontPt).toBeCloseTo(
        baseMinFontPx * res.effectiveScale * MM_TO_PT,
        6,
      );
      expect(res.cols).toBeGreaterThanOrEqual(1);
      expect(res.rows).toBeGreaterThanOrEqual(1);
      expect(res.totalTiles).toBe(res.cols * res.rows);
    });
  });
});

describe('url-state', () => {
  it('round-trips DEFAULT_EXPORT_SETTINGS cleanly with empty URLSearchParams', () => {
    const params = serializeExportSettingsToSearchParams(DEFAULT_EXPORT_SETTINGS);
    expect(params.toString()).toBe('');
    const parsed = parseExportSettingsFromSearchParams(params);
    expect(parsed).toEqual(DEFAULT_EXPORT_SETTINGS);
  });

  it('preserves ?cabang= compatibility from the main tree page', () => {
    const parsed = parseExportSettingsFromSearchParams('?cabang=p-sukijah');
    expect(parsed.scope.branchId).toBe('p-sukijah');
    expect(parsed.mode).toBe(DEFAULT_EXPORT_SETTINGS.mode);

    const serialized = serializeExportSettingsToSearchParams(parsed);
    expect(serialized.get('cabang')).toBe('p-sukijah');
  });

  it('round-trips all custom /cetak settings losslessly', () => {
    const customSettings: ExportSettings = {
      mode: 'book',
      format: 'zip-jpg',
      treeOrientation: 'LEFT_RIGHT',
      theme: 'monochrome',
      cardPreset: 'custom',
      cardToggles: {
        photo: false,
        nickname: true,
        birthDeathPlaceYear: false,
        generationBadge: true,
        genderIcon: false,
        deceasedBadge: true,
      },
      scope: {
        branchId: 'branch-sukijah',
        subtreeRootPersonId: 'person-ali',
        minGeneration: 2,
        maxGeneration: 5,
      },
      paper: {
        sizeId: 'CUSTOM',
        customWidthMm: 240,
        customHeightMm: 360,
        orientation: 'portrait',
        marginMm: 12,
        overlapMm: 15,
        showCutMarks: false,
        showTileLabels: false,
        includeAssemblyMap: false,
      },
      scale: {
        mode: 'fit-grid',
        percentage: 85,
        fitCols: 4,
        fitRows: 3,
        minFontPt: 9.5,
      },
      meta: {
        title: 'Silsilah Keluarga Ali',
        subtitle: 'Ranting 1. Sukijah • G2–G5',
        includeCoverPage: false,
        includeLegend: false,
        includeFooter: false,
      },
      pngDpi: 300,
    };

    const params = serializeExportSettingsToSearchParams(customSettings);
    const parsedFromUsp = parseExportSettingsFromSearchParams(params);
    expect(parsedFromUsp).toEqual(customSettings);

    // Also test Next.js Server Component Record<string, string | string[] | undefined> format
    const recordObj: Record<string, string> = {};
    params.forEach((value, key) => {
      recordObj[key] = value;
    });
    expect(parseExportSettingsFromSearchParams(recordObj)).toEqual(customSettings);
  });

  it('round-trips all-false card toggles and preset mismatches', () => {
    const settings: ExportSettings = {
      ...DEFAULT_EXPORT_SETTINGS,
      cardPreset: 'compact',
      cardToggles: {
        photo: false,
        nickname: false,
        birthDeathPlaceYear: false,
        generationBadge: false,
        genderIcon: false,
        deceasedBadge: false,
      },
    };
    const params = serializeExportSettingsToSearchParams(settings);
    expect(params.get('kartu')).toBe('compact');
    expect(params.get('elemen')).toBe('none');
    expect(parseExportSettingsFromSearchParams(params)).toEqual(settings);

    // Preset without custom elemen override restores preset toggles
    const compactOnly = parseExportSettingsFromSearchParams('kartu=compact');
    expect(compactOnly.cardToggles).toEqual(CARD_PRESETS.compact.toggles);
  });

  it('builds standardized export filenames with branch slug and date', () => {
    const branchSettings: ExportSettings = {
      ...DEFAULT_EXPORT_SETTINGS,
      scope: {
        ...DEFAULT_EXPORT_SETTINGS.scope,
        branchId: 'b-sukijah',
      },
      meta: {
        ...DEFAULT_EXPORT_SETTINGS.meta,
        subtitle: 'Ranting 1. Sukijah • G1–G4',
      },
    };

    expect(
      buildExportFilename(branchSettings, 'pdf', new Date('2026-11-23T12:00:00Z')),
    ).toBe('silsilah-bani-sukar-ranting-sukijah-2026-11-23.pdf');

    expect(
      buildExportFilename(branchSettings, '.png', '2026-11-23'),
    ).toBe('silsilah-bani-sukar-ranting-sukijah-2026-11-23.png');

    expect(
      buildExportFilename(DEFAULT_EXPORT_SETTINGS, 'svg', '2026-11-23'),
    ).toBe('silsilah-bani-sukar-2026-11-23.svg');

    expect(
      buildExportFilename(
        {
          ...DEFAULT_EXPORT_SETTINGS,
          scope: { ...DEFAULT_EXPORT_SETTINGS.scope, branchId: 'id-123' },
        },
        'zip',
        '2026-11-23',
        '2. Martono',
      ),
    ).toBe('silsilah-bani-sukar-ranting-martono-2026-11-23.zip');
  });
});
