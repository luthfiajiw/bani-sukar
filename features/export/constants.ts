import type {
  CardPresetDefinition,
  CardPresetId,
  ExportSettings,
  PaperSizeDefinition,
  PaperSizeId,
} from './types';

/** Konversi piksel scene (96 DPI CSS) ke milimeter: 25.4 / 96 ≈ 0.264583 mm/px */
export const PX_TO_MM = 25.4 / 96;
/** Konversi milimeter ke piksel scene (96 DPI CSS) */
export const MM_TO_PX = 96 / 25.4;
/** Konversi poin tipografi (72 pt/inch) ke milimeter */
export const PT_TO_MM = 25.4 / 72;
/** Konversi milimeter ke poin tipografi (72 pt/inch) */
export const MM_TO_PT = 72 / 25.4;
/** Konversi piksel scene (96 DPI) ke poin tipografi (72 pt/inch) */
export const PX_TO_PT = 72 / 96;
/** Konversi poin tipografi (72 pt/inch) ke piksel scene (96 DPI) */
export const PT_TO_PX = 96 / 72;

/** Konstanta text-fitting nama pada kartu cetak */
export const BASE_NAME_FONT_SIZE_PX = 12;
export const MIN_NAME_FONT_SIZE_PX = 9.5;
export const NAME_FONT_SIZE_STEPS_PX = [12, 11, 10, 9.5] as const;
export const MAX_NAME_LINES_BEFORE_SHRINK = 3;
export const SCENE_OUTER_PADDING_PX = 40;

/** Batas aman kanvas raster browser untuk mencegah crash memori */
export const DESKTOP_MAX_CANVAS_PIXELS = 25_000_000;
export const MOBILE_MAX_CANVAS_PIXELS = 12_000_000;
export const MAX_CANVAS_SIDE_PX = 16_384;

/** Definisi ukuran kertas standar dalam milimeter (orientasi portrait dasar) */
export const PAPER_SIZES: Record<PaperSizeId, PaperSizeDefinition> = {
  A4: {
    id: 'A4',
    label: 'A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
  },
  A3: {
    id: 'A3',
    label: 'A3 (297 × 420 mm)',
    widthMm: 297,
    heightMm: 420,
  },
  F4: {
    id: 'F4',
    label: 'F4 / Folio (215 × 330 mm)',
    widthMm: 215,
    heightMm: 330,
  },
  LETTER: {
    id: 'LETTER',
    label: 'Letter (215.9 × 279.4 mm)',
    widthMm: 215.9,
    heightMm: 279.4,
  },
  CUSTOM: {
    id: 'CUSTOM',
    label: 'Kustom (mm)',
    widthMm: 210,
    heightMm: 297,
  },
};

/** Preset isi & dimensi default kartu cetak */
export const CARD_PRESETS: Record<CardPresetId, CardPresetDefinition> = {
  full: {
    id: 'full',
    label: 'Lengkap',
    description: 'Foto, nama lengkap, panggilan, tempat/tahun, generasi, gender, status',
    defaultWidth: 200,
    defaultHeight: 100,
    toggles: {
      photo: true,
      nickname: true,
      birthDeathPlaceYear: true,
      generationBadge: true,
      genderIcon: true,
      deceasedBadge: true,
    },
  },
  compact: {
    id: 'compact',
    label: 'Ringkas',
    description: 'Nama lengkap, panggilan, badge generasi, dan status Alm./Almh.',
    defaultWidth: 168,
    defaultHeight: 74,
    toggles: {
      photo: false,
      nickname: true,
      birthDeathPlaceYear: false,
      generationBadge: true,
      genderIcon: false,
      deceasedBadge: true,
    },
  },
  minimal: {
    id: 'minimal',
    label: 'Nama Saja',
    description: 'Nama lengkap dan penanda Alm./Almh. agar muat lebih banyak',
    defaultWidth: 144,
    defaultHeight: 54,
    toggles: {
      photo: false,
      nickname: false,
      birthDeathPlaceYear: false,
      generationBadge: false,
      genderIcon: false,
      deceasedBadge: true,
    },
  },
  custom: {
    id: 'custom',
    label: 'Kustom',
    description: 'Pilih elemen kartu secara bebas',
    defaultWidth: 190,
    defaultHeight: 90,
    toggles: {
      photo: true,
      nickname: true,
      birthDeathPlaceYear: true,
      generationBadge: true,
      genderIcon: true,
      deceasedBadge: true,
    },
  },
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  mode: 'poster',
  format: 'pdf',
  treeOrientation: 'TOP_DOWN',
  theme: 'color',
  cardPreset: 'full',
  cardToggles: { ...CARD_PRESETS.full.toggles },
  scope: {
    branchId: null,
    subtreeRootPersonId: null,
    minGeneration: 1,
    maxGeneration: 99,
  },
  paper: {
    sizeId: 'A4',
    customWidthMm: 210,
    customHeightMm: 297,
    orientation: 'landscape',
    marginMm: 8,
    overlapMm: 10,
    showCutMarks: true,
    showTileLabels: true,
    includeAssemblyMap: true,
  },
  scale: {
    mode: 'min-font',
    percentage: 100,
    fitCols: 3,
    fitRows: 2,
    minFontPt: 8,
  },
  meta: {
    title: 'Silsilah Trah Bani Sukar & Sadirah',
    subtitle: 'Seluruh Bagan',
    includeCoverPage: true,
    includeLegend: true,
    includeFooter: true,
  },
  pngDpi: 150,
};
