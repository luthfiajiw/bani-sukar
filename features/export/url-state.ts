import { CARD_PRESETS, DEFAULT_EXPORT_SETTINGS } from './constants';
import type {
  CardElementToggles,
  CardPresetId,
  ExportFormat,
  ExportMode,
  ExportSettings,
  PaperOrientation,
  PaperSizeId,
  PrintThemeId,
  ScaleMode,
  TreeOrientation,
} from './types';

export type SearchParamsInput =
  | URLSearchParams
  | { get(name: string): string | null }
  | string
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

const VALID_MODES = new Set<ExportMode>(['poster', 'book']);
const VALID_FORMATS = new Set<ExportFormat>([
  'pdf',
  'png',
  'zip-png',
  'zip-jpg',
  'svg',
]);
const VALID_TREE_ORIENTATIONS = new Set<TreeOrientation>([
  'TOP_DOWN',
  'LEFT_RIGHT',
]);
const VALID_THEMES = new Set<PrintThemeId>(['color', 'ink-saver', 'monochrome']);
const VALID_CARD_PRESETS = new Set<CardPresetId>([
  'full',
  'compact',
  'minimal',
  'custom',
]);
const VALID_PAPER_SIZES = new Set<PaperSizeId>([
  'A4',
  'A3',
  'F4',
  'LETTER',
  'CUSTOM',
]);
const VALID_PAPER_ORIENTATIONS = new Set<PaperOrientation>([
  'portrait',
  'landscape',
]);
const VALID_SCALE_MODES = new Set<ScaleMode>([
  'percentage',
  'fit-grid',
  'min-font',
]);

const TOGGLE_KEYS: Array<keyof CardElementToggles> = [
  'photo',
  'nickname',
  'birthDeathPlaceYear',
  'generationBadge',
  'genderIcon',
  'deceasedBadge',
];

function cloneDefaultSettings(): ExportSettings {
  return {
    ...DEFAULT_EXPORT_SETTINGS,
    cardToggles: { ...DEFAULT_EXPORT_SETTINGS.cardToggles },
    scope: { ...DEFAULT_EXPORT_SETTINGS.scope },
    paper: { ...DEFAULT_EXPORT_SETTINGS.paper },
    scale: { ...DEFAULT_EXPORT_SETTINGS.scale },
    meta: { ...DEFAULT_EXPORT_SETTINGS.meta },
  };
}

function togglesEqual(a: CardElementToggles, b: CardElementToggles): boolean {
  return TOGGLE_KEYS.every((k) => a[k] === b[k]);
}

function serializeToggles(toggles: CardElementToggles): string {
  const active = TOGGLE_KEYS.filter((k) => toggles[k]);
  return active.length > 0 ? active.join(',') : 'none';
}

function parseToggles(
  raw: string,
  fallback: CardElementToggles,
): CardElementToggles {
  if (raw === 'none') {
    return {
      photo: false,
      nickname: false,
      birthDeathPlaceYear: false,
      generationBadge: false,
      genderIcon: false,
      deceasedBadge: false,
    };
  }
  const parts = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (parts.size === 0) {
    return { ...fallback };
  }
  return {
    photo: parts.has('photo'),
    nickname: parts.has('nickname'),
    birthDeathPlaceYear: parts.has('birthDeathPlaceYear'),
    generationBadge: parts.has('generationBadge'),
    genderIcon: parts.has('genderIcon'),
    deceasedBadge: parts.has('deceasedBadge'),
  };
}

function getParamReader(input: SearchParamsInput): (key: string) => string | null {
  if (!input) {
    return () => null;
  }
  if (typeof input === 'string') {
    const cleaned = input.startsWith('?') ? input.slice(1) : input;
    const usp = new URLSearchParams(cleaned);
    return (k) => usp.get(k);
  }
  if (typeof (input as { get?: unknown }).get === 'function') {
    const getter = input as { get(name: string): string | null };
    return (k) => getter.get(k);
  }
  const record = input as Record<string, string | string[] | undefined>;
  return (k) => {
    const val = record[k];
    if (Array.isArray(val)) return val[0] ?? null;
    return typeof val === 'string' ? val : null;
  };
}

function parseBooleanParam(raw: string | null, fallback: boolean): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function parseNumberParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
  integer = false,
): number {
  if (raw === null || raw.trim() === '') return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.min(max, Math.max(min, num));
  return integer ? Math.round(clamped) : clamped;
}

/**
 * Menyandikan seluruh pengaturan `/cetak` ke dalam URLSearchParams secara ringkas
 * dan deterministik, mempertahankan kompatibilitas `?cabang=` dari halaman utama.
 */
export function serializeExportSettingsToSearchParams(
  settings: ExportSettings,
): URLSearchParams {
  const params = new URLSearchParams();
  const def = DEFAULT_EXPORT_SETTINGS;

  // Cakupan
  if (settings.scope.branchId) {
    params.set('cabang', settings.scope.branchId);
  }
  if (settings.scope.subtreeRootPersonId) {
    params.set('akar', settings.scope.subtreeRootPersonId);
  }
  if (settings.scope.minGeneration !== def.scope.minGeneration) {
    params.set('genMin', String(settings.scope.minGeneration));
  }
  if (settings.scope.maxGeneration !== def.scope.maxGeneration) {
    params.set('genMax', String(settings.scope.maxGeneration));
  }

  // Mode, format, orientasi pohon, tema
  if (settings.mode !== def.mode) {
    params.set('mode', settings.mode);
  }
  if (settings.format !== def.format) {
    params.set('format', settings.format);
  }
  if (settings.treeOrientation !== def.treeOrientation) {
    params.set('arah', settings.treeOrientation);
  }
  if (settings.theme !== def.theme) {
    params.set('tema', settings.theme);
  }

  // Preset & toggle kartu
  if (settings.cardPreset !== def.cardPreset) {
    params.set('kartu', settings.cardPreset);
  }
  const presetToggles = CARD_PRESETS[settings.cardPreset].toggles;
  if (!togglesEqual(settings.cardToggles, presetToggles)) {
    params.set('elemen', serializeToggles(settings.cardToggles));
  }

  // Konfigurasi kertas & tiling
  if (settings.paper.sizeId !== def.paper.sizeId) {
    params.set('kertas', settings.paper.sizeId);
  }
  if (
    settings.paper.sizeId === 'CUSTOM' ||
    settings.paper.customWidthMm !== def.paper.customWidthMm
  ) {
    params.set('lebar', String(settings.paper.customWidthMm));
  }
  if (
    settings.paper.sizeId === 'CUSTOM' ||
    settings.paper.customHeightMm !== def.paper.customHeightMm
  ) {
    params.set('tinggi', String(settings.paper.customHeightMm));
  }
  if (settings.paper.orientation !== def.paper.orientation) {
    params.set('posisi', settings.paper.orientation);
  }
  if (settings.paper.marginMm !== def.paper.marginMm) {
    params.set('margin', String(settings.paper.marginMm));
  }
  if (settings.paper.overlapMm !== def.paper.overlapMm) {
    params.set('overlap', String(settings.paper.overlapMm));
  }
  if (settings.paper.showCutMarks !== def.paper.showCutMarks) {
    params.set('potong', settings.paper.showCutMarks ? '1' : '0');
  }
  if (settings.paper.showTileLabels !== def.paper.showTileLabels) {
    params.set('labelTile', settings.paper.showTileLabels ? '1' : '0');
  }
  if (settings.paper.includeAssemblyMap !== def.paper.includeAssemblyMap) {
    params.set('peta', settings.paper.includeAssemblyMap ? '1' : '0');
  }

  // Konfigurasi skala
  if (settings.scale.mode !== def.scale.mode) {
    params.set('skala', settings.scale.mode);
  }
  if (
    settings.scale.mode === 'percentage' ||
    settings.scale.percentage !== def.scale.percentage
  ) {
    params.set('persen', String(settings.scale.percentage));
  }
  if (
    settings.scale.mode === 'fit-grid' ||
    settings.scale.fitCols !== def.scale.fitCols
  ) {
    params.set('kolom', String(settings.scale.fitCols));
  }
  if (
    settings.scale.mode === 'fit-grid' ||
    settings.scale.fitRows !== def.scale.fitRows
  ) {
    params.set('baris', String(settings.scale.fitRows));
  }
  if (
    settings.scale.mode === 'min-font' &&
    settings.scale.minFontPt !== def.scale.minFontPt
  ) {
    params.set('minPt', String(settings.scale.minFontPt));
  } else if (
    settings.scale.mode !== 'min-font' &&
    settings.scale.minFontPt !== def.scale.minFontPt
  ) {
    params.set('minPt', String(settings.scale.minFontPt));
  }

  // Meta dokumen & DPI
  if (settings.meta.title !== def.meta.title) {
    params.set('judul', settings.meta.title);
  }
  if (settings.meta.subtitle !== def.meta.subtitle) {
    params.set('subjudul', settings.meta.subtitle);
  }
  if (settings.meta.includeCoverPage !== def.meta.includeCoverPage) {
    params.set('sampul', settings.meta.includeCoverPage ? '1' : '0');
  }
  if (settings.meta.includeLegend !== def.meta.includeLegend) {
    params.set('legenda', settings.meta.includeLegend ? '1' : '0');
  }
  if (settings.meta.includeFooter !== def.meta.includeFooter) {
    params.set('footer', settings.meta.includeFooter ? '1' : '0');
  }
  if (settings.pngDpi !== def.pngDpi) {
    params.set('dpi', String(settings.pngDpi));
  }

  return params;
}

/**
 * Mengurai parameter query URL (termasuk `?cabang=` dari halaman utama)
 * menjadi objek `ExportSettings` yang lengkap dan tervalidasi.
 */
export function parseExportSettingsFromSearchParams(
  input: SearchParamsInput,
): ExportSettings {
  const get = getParamReader(input);
  const next = cloneDefaultSettings();

  // Cakupan
  const cabang = get('cabang');
  if (cabang && cabang.trim() !== '') {
    next.scope.branchId = cabang.trim();
  }
  const akar = get('akar');
  if (akar && akar.trim() !== '') {
    next.scope.subtreeRootPersonId = akar.trim();
  }
  next.scope.minGeneration = parseNumberParam(
    get('genMin'),
    next.scope.minGeneration,
    1,
    99,
    true,
  );
  next.scope.maxGeneration = parseNumberParam(
    get('genMax'),
    next.scope.maxGeneration,
    next.scope.minGeneration,
    99,
    true,
  );

  // Mode, format, orientasi pohon, tema
  const mode = get('mode') as ExportMode | null;
  if (mode && VALID_MODES.has(mode)) {
    next.mode = mode;
  }
  const format = get('format') as ExportFormat | null;
  if (format && VALID_FORMATS.has(format)) {
    next.format = format;
  }
  const arah = get('arah') as TreeOrientation | null;
  if (arah && VALID_TREE_ORIENTATIONS.has(arah)) {
    next.treeOrientation = arah;
  }
  const tema = get('tema') as PrintThemeId | null;
  if (tema && VALID_THEMES.has(tema)) {
    next.theme = tema;
  }

  // Preset & toggle kartu
  const kartu = get('kartu') as CardPresetId | null;
  if (kartu && VALID_CARD_PRESETS.has(kartu)) {
    next.cardPreset = kartu;
    next.cardToggles = { ...CARD_PRESETS[kartu].toggles };
  }
  const elemen = get('elemen');
  if (elemen !== null) {
    next.cardToggles = parseToggles(elemen, next.cardToggles);
  }

  // Kertas & tiling
  const kertas = get('kertas') as PaperSizeId | null;
  if (kertas && VALID_PAPER_SIZES.has(kertas)) {
    next.paper.sizeId = kertas;
  }
  next.paper.customWidthMm = parseNumberParam(
    get('lebar'),
    next.paper.customWidthMm,
    20,
    5000,
  );
  next.paper.customHeightMm = parseNumberParam(
    get('tinggi'),
    next.paper.customHeightMm,
    20,
    5000,
  );
  const posisi = get('posisi') as PaperOrientation | null;
  if (posisi && VALID_PAPER_ORIENTATIONS.has(posisi)) {
    next.paper.orientation = posisi;
  }
  next.paper.marginMm = parseNumberParam(
    get('margin'),
    next.paper.marginMm,
    0,
    50,
  );
  next.paper.overlapMm = parseNumberParam(
    get('overlap'),
    next.paper.overlapMm,
    0,
    50,
  );
  next.paper.showCutMarks = parseBooleanParam(
    get('potong'),
    next.paper.showCutMarks,
  );
  next.paper.showTileLabels = parseBooleanParam(
    get('labelTile'),
    next.paper.showTileLabels,
  );
  next.paper.includeAssemblyMap = parseBooleanParam(
    get('peta'),
    next.paper.includeAssemblyMap,
  );

  // Skala
  const skala = get('skala') as ScaleMode | null;
  if (skala && VALID_SCALE_MODES.has(skala)) {
    next.scale.mode = skala;
  }
  next.scale.percentage = parseNumberParam(
    get('persen'),
    next.scale.percentage,
    10,
    500,
  );
  next.scale.fitCols = parseNumberParam(
    get('kolom'),
    next.scale.fitCols,
    1,
    50,
    true,
  );
  next.scale.fitRows = parseNumberParam(
    get('baris'),
    next.scale.fitRows,
    1,
    50,
    true,
  );
  next.scale.minFontPt = parseNumberParam(
    get('minPt'),
    next.scale.minFontPt,
    4,
    36,
  );

  // Meta dokumen & DPI
  const judul = get('judul');
  if (judul !== null) {
    next.meta.title = judul;
  }
  const subjudul = get('subjudul');
  if (subjudul !== null) {
    next.meta.subtitle = subjudul;
  }
  next.meta.includeCoverPage = parseBooleanParam(
    get('sampul'),
    next.meta.includeCoverPage,
  );
  next.meta.includeLegend = parseBooleanParam(
    get('legenda'),
    next.meta.includeLegend,
  );
  next.meta.includeFooter = parseBooleanParam(
    get('footer'),
    next.meta.includeFooter,
  );
  const dpi = get('dpi');
  if (dpi === '300') {
    next.pngDpi = 300;
  } else if (dpi === '150') {
    next.pngDpi = 150;
  }

  return next;
}

function slugifySegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDateYyyyMmDd(date?: Date | string): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d =
    date instanceof Date
      ? date
      : typeof date === 'string'
        ? new Date(date)
        : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractScopeSlug(
  settings: ExportSettings,
  scopeLabel?: string,
): string | null {
  const defaultSub = DEFAULT_EXPORT_SETTINGS.meta.subtitle.toLowerCase();
  const rawLabel = scopeLabel?.trim();

  if (rawLabel) {
    const cleaned = rawLabel.replace(/^\d+\.\s*/, '').trim();
    const slug = slugifySegment(cleaned);
    if (slug) {
      if (settings.scope.branchId && !slug.startsWith('ranting-')) {
        return `ranting-${slug}`;
      }
      return slug;
    }
  }

  const subtitlePrimary = settings.meta.subtitle.split('•')[0]?.trim() ?? '';
  if (
    subtitlePrimary &&
    subtitlePrimary.toLowerCase() !== defaultSub &&
    subtitlePrimary.toLowerCase() !== 'semua cabang'
  ) {
    // Normalisasi "Ranting 1. Sukijah" -> "Ranting Sukijah"
    const normalized = subtitlePrimary.replace(
      /\b(ranting)\s+\d+\.\s*/i,
      '$1 ',
    );
    const slug = slugifySegment(normalized);
    if (slug) {
      return slug;
    }
  }

  if (settings.scope.branchId) {
    const branchSlug = slugifySegment(settings.scope.branchId);
    if (branchSlug) {
      return branchSlug.startsWith('ranting-')
        ? branchSlug
        : `ranting-${branchSlug}`;
    }
  }

  if (settings.scope.subtreeRootPersonId) {
    const rootSlug = slugifySegment(settings.scope.subtreeRootPersonId);
    if (rootSlug) {
      return rootSlug;
    }
  }

  return null;
}

/**
 * Membentuk nama berkas ekspor standar, misalnya:
 * `silsilah-bani-sukar-ranting-sukijah-2026-11-23.pdf`.
 */
export function buildExportFilename(
  settings: ExportSettings,
  extension: string,
  date?: Date | string,
  scopeLabel?: string,
): string {
  const ext = extension.replace(/^\.+/, '').trim().toLowerCase() || 'pdf';
  const datePart = formatDateYyyyMmDd(date);
  const scopeSlug = extractScopeSlug(settings, scopeLabel);

  const parts = ['silsilah-bani-sukar'];
  if (scopeSlug) {
    parts.push(scopeSlug);
  }
  parts.push(datePart);

  return `${parts.join('-')}.${ext}`;
}
