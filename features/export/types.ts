import type {
  FamilyGraph,
  Person,
  TreeLayoutResult,
  Union,
} from '@/features/family/types';

export type { FamilyGraph, Person, TreeLayoutResult, Union };

export type ExportMode = 'poster' | 'book';
export type ExportFormat = 'pdf' | 'png' | 'zip-png' | 'zip-jpg' | 'svg';
export type TreeOrientation = 'TOP_DOWN' | 'LEFT_RIGHT';
export type PrintThemeId = 'color' | 'ink-saver' | 'monochrome';
export type CardPresetId = 'full' | 'compact' | 'minimal' | 'custom';
export type PaperSizeId = 'A4' | 'A3' | 'F4' | 'LETTER' | 'CUSTOM';
export type PaperOrientation = 'portrait' | 'landscape';
export type ScaleMode = 'percentage' | 'fit-grid' | 'min-font';

export interface CardElementToggles {
  photo: boolean;
  nickname: boolean;
  birthDeathPlaceYear: boolean;
  generationBadge: boolean;
  genderIcon: boolean;
  /** Teks "Alm." / "Almh." + titik status hidup/wafat (tanpa simbol salib). */
  deceasedBadge: boolean;
}

export interface ExportScopeOptions {
  branchId: string | null;
  subtreeRootPersonId: string | null;
  minGeneration: number; // default 1
  maxGeneration: number; // default 99
}

export interface PaperConfig {
  sizeId: PaperSizeId;
  customWidthMm: number;  // default 210
  customHeightMm: number; // default 297
  orientation: PaperOrientation;
  marginMm: number;       // default 8
  overlapMm: number;      // default 10 (untuk poster tiling)
  showCutMarks: boolean;
  showTileLabels: boolean;
  includeAssemblyMap: boolean;
}

export interface ScaleConfig {
  mode: ScaleMode;
  percentage: number;     // mis. 100
  fitCols: number;        // mis. 3
  fitRows: number;        // mis. 2
  minFontPt: number;      // mis. 8
}

export interface DocumentMetaConfig {
  title: string;
  subtitle: string;
  includeCoverPage: boolean;
  includeLegend: boolean;
  includeFooter: boolean;
}

export interface ExportSettings {
  mode: ExportMode;
  format: ExportFormat;
  treeOrientation: TreeOrientation;
  theme: PrintThemeId;
  cardPreset: CardPresetId;
  cardToggles: CardElementToggles;
  scope: ExportScopeOptions;
  paper: PaperConfig;
  scale: ScaleConfig;
  meta: DocumentMetaConfig;
  pngDpi: 150 | 300;
}

export interface FittedTextLine {
  text: string;
}

export interface FittedPersonCardMetric {
  personId: string;
  width: number;
  height: number;
  nameFontSizePx: number;
  nameLines: string[];
  deceasedPrefix: 'Alm.' | 'Almh.' | null;
}

export interface SceneRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

export interface SceneText {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
}

export interface ScenePath {
  kind: 'path';
  d: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  fill?: string;
}

export interface SceneCircle {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface SceneImage {
  kind: 'image';
  personId: string;
  href: string; // data URL atau public URL
  x: number;
  y: number;
  width: number;
  height: number;
  clipCircle: boolean;
}

export type ScenePrimitive =
  | SceneRect
  | SceneText
  | ScenePath
  | SceneCircle
  | SceneImage;

export interface SceneBoundsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportScene {
  width: number;
  height: number;
  backgroundColor: string;
  primitives: ScenePrimitive[];
  nodeBounds: Map<string, SceneBoundsRect>;
}

export interface PosterTile {
  index: number;
  row: number;         // 0-based
  col: number;         // 0-based
  coordLabel: string;  // "A1", "A2", "B1"...
  neighborLabels: {
    top: string | null;
    right: string | null;
    bottom: string | null;
    left: string | null;
  };
  /** Area dalam koordinat scene (px) yang dicetak di tile ini (sudah termasuk overlap) */
  sceneCropRect: SceneBoundsRect;
  /** Area efektif tanpa overlap dalam koordinat scene (px) */
  coreSceneRect: SceneBoundsRect;
}

export interface PosterPaginationResult {
  paperWidthMm: number;
  paperHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  effectiveScale: number; // rasio px scene -> mm kertas
  effectiveMinFontPt: number;
  cols: number;
  rows: number;
  totalTiles: number;
  tiles: PosterTile[];
}

export interface BookContinuationMarker {
  personId: string;
  fullName: string;
  targetPageNumber: number; // "→ hal. 12"
}

export interface BookPageDescriptor {
  pageNumber: number; // 1-based (di luar halaman sampul)
  rootPersonId: string;
  rootPersonName: string;
  parentPageNumber: number | null;
  lineageBreadcrumb: string[]; // ["Sukar", "Sukijah", "Ali"]
  includedPersonIds: Set<string>;
  includedUnionIds: Set<string>;
  continuations: BookContinuationMarker[];
  layout: TreeLayoutResult;
  scene: ExportScene;
}

export interface BookPaginationResult {
  pages: BookPageDescriptor[];
  totalPages: number;
}

export interface PaperSizeDefinition {
  id: PaperSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface CardPresetDefinition {
  id: CardPresetId;
  label: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  toggles: CardElementToggles;
}

export interface PrintThemePalette {
  id: PrintThemeId;
  label: string;
  backgroundColor: string;
  cardBloodBg: string;
  cardSpouseBg: string;
  cardBorder: string;
  cardSpouseBorder: string;
  cardAccentMale: string;
  cardAccentFemale: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  badgeBg: string;
  badgeText: string;
  aliveDotFill: string;
  deceasedDotFill: string;
  deceasedDotStroke: string;
  edgeNasab: string;
  edgeMarried: string;
  edgeDivorced: string;
  edgeWidowed: string;
  unionFill: string;
  unionStroke: string;
  continuationBg: string;
  continuationBorder: string;
  continuationText: string;
}

export interface ExportProgress {
  phase: 'preparing' | 'photos' | 'rendering' | 'packaging' | 'done';
  current: number;
  total: number;
  message?: string;
}

export interface ExportExecutionOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

export type RasterExportResult =
  | {
      ok: true;
      blob: Blob;
      widthPx: number;
      heightPx: number;
    }
  | {
      ok: false;
      exceedsCanvasLimit: true;
      widthPx: number;
      heightPx: number;
      totalPixels: number;
      recommendedAction: 'zip-tiles' | 'lower-dpi';
    };

export interface ExportSummaryStats {
  personCount: number;
  unionCount: number;
  minGeneration: number;
  maxGeneration: number;
}
